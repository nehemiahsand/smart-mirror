#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <Wire.h>

#include "config.h"

namespace Pins {
constexpr uint8_t BUTTON_PREV = 25;
constexpr uint8_t BUTTON_NEXT = 26;
constexpr uint8_t BUTTON_PRIMARY = 27;
constexpr uint8_t BUTTON_BACK = 32;
constexpr uint8_t POTENTIOMETER = 34;
constexpr uint8_t PIR_MOTION = 33;
constexpr uint8_t OLED_SDA = 21;
constexpr uint8_t OLED_SCL = 22;
}  // namespace Pins

enum class ButtonCommand : uint8_t {
  Previous = 0,
  Next = 1,
  Primary = 2,
  Back = 3,
};

struct ButtonState {
  uint8_t pin;
  ButtonCommand command;
  bool stablePressed;
  bool lastRawPressed;
  bool longSent;
  unsigned long lastChangeMs;
  unsigned long pressedAtMs;
};

struct MirrorState {
  bool backendReachable = false;
  bool interactiveActive = false;
  String activePageId = "dynamic";
  String pageTitle = "Smart Mirror";
  String statusLabel = "Waiting for backend";
  String lastAction = "Booting";
  String button1 = "Prev";
  String button2 = "Next";
  String button3 = "OK";
  String button4 = "Back";
  String dial = "Adjust";
};

namespace {
Adafruit_SSD1306 gDisplay(Config::SCREEN_WIDTH, Config::SCREEN_HEIGHT, &Wire, -1);
WiFiClient gWiFiClient;
PubSubClient gMqttClient(gWiFiClient);

ButtonState gButtons[] = {
    {Pins::BUTTON_PREV, ButtonCommand::Previous, false, false, false, 0, 0},
    {Pins::BUTTON_NEXT, ButtonCommand::Next, false, false, false, 0, 0},
    {Pins::BUTTON_PRIMARY, ButtonCommand::Primary, false, false, false, 0, 0},
    {Pins::BUTTON_BACK, ButtonCommand::Back, false, false, false, 0, 0},
};

MirrorState gMirrorState;

String gEventTopic;
String gStatusTopic;
String gLastEvent = "Booting";

bool gMotionActive = false;
bool gDisplayReady = false;

unsigned long gLastWifiAttemptMs = 0;
unsigned long gLastMqttAttemptMs = 0;
unsigned long gLastStatePollMs = 0;
unsigned long gLastOledRenderMs = 0;
unsigned long gLastMotionMs = 0;
unsigned long gLastDialEmitMs = 0;

int gLastDialReading = 0;
int gLastDialBucket = 0;

const char* buttonAction(ButtonCommand command) {
  switch (command) {
    case ButtonCommand::Previous:
      return "previous";
    case ButtonCommand::Next:
      return "next";
    case ButtonCommand::Primary:
      return "primary";
    case ButtonCommand::Back:
      return "back";
    default:
      return "primary";
  }
}

const char* buttonId(ButtonCommand command) {
  switch (command) {
    case ButtonCommand::Previous:
      return "button1";
    case ButtonCommand::Next:
      return "button2";
    case ButtonCommand::Primary:
      return "button3";
    case ButtonCommand::Back:
      return "button4";
    default:
      return "button3";
  }
}

String clipLine(const String& value, size_t maxLength = 20) {
  if (value.length() <= maxLength) {
    return value;
  }

  if (maxLength <= 1) {
    return value.substring(0, maxLength);
  }

  return value.substring(0, maxLength - 1) + "~";
}

String backendUrl(const char* path) {
  return String(Config::BACKEND_BASE_URL) + path;
}

bool wifiConnected() { return WiFi.status() == WL_CONNECTED; }

void resetMirrorState() {
  gMirrorState.backendReachable = false;
  gMirrorState.interactiveActive = false;
  gMirrorState.activePageId = "dynamic";
  gMirrorState.pageTitle = "Smart Mirror";
  gMirrorState.statusLabel = wifiConnected() ? "Waiting for backend" : "Waiting for WiFi";
  gMirrorState.lastAction = gLastEvent;
  gMirrorState.button1 = "Prev";
  gMirrorState.button2 = "Next";
  gMirrorState.button3 = "OK";
  gMirrorState.button4 = "Back";
  gMirrorState.dial = "Adjust";
}

bool publishStatus(bool online) {
  if (!gMqttClient.connected()) {
    return false;
  }

  return gMqttClient.publish(gStatusTopic.c_str(), online ? "online" : "offline", true);
}

bool publishJson(const char* type, JsonDocument& payload) {
  if (!gMqttClient.connected()) {
    return false;
  }

  StaticJsonDocument<512> document;
  document["deviceId"] = Config::DEVICE_ID;
  document["timestamp"] = millis();
  document["type"] = type;

  JsonObject outPayload = document.createNestedObject("payload");
  for (JsonPairConst item : payload.as<JsonObjectConst>()) {
    outPayload[item.key()] = item.value();
  }

  char buffer[512] = {0};
  const size_t length = serializeJson(document, buffer, sizeof(buffer));
  const bool published = gMqttClient.publish(
      gEventTopic.c_str(), reinterpret_cast<const uint8_t*>(buffer),
      static_cast<unsigned int>(length), false);
  if (published) {
    gLastEvent = type;
    gMirrorState.lastAction = gLastEvent;
  }
  return published;
}

bool publishAction(ButtonCommand command, bool hold) {
  StaticJsonDocument<192> payload;
  payload["pageId"] = gMirrorState.activePageId;
  payload["buttonId"] = buttonId(command);
  payload["action"] = buttonAction(command);
  payload["hold"] = hold;
  return publishJson("ui.action", payload);
}

bool publishAdjust(int delta) {
  StaticJsonDocument<128> payload;
  payload["pageId"] = gMirrorState.activePageId;
  payload["delta"] = delta;
  return publishJson("ui.adjust", payload);
}

bool publishMotion(const char* type) {
  StaticJsonDocument<32> payload;
  return publishJson(type, payload);
}

void connectWiFi() {
  if (wifiConnected()) {
    return;
  }

  const unsigned long nowMs = millis();
  if ((nowMs - gLastWifiAttemptMs) < Config::WIFI_RECONNECT_INTERVAL_MS) {
    return;
  }

  gLastWifiAttemptMs = nowMs;
  WiFi.mode(WIFI_STA);
  WiFi.begin(Config::WIFI_SSID, Config::WIFI_PASSWORD);
  Serial.printf("[wifi] connecting to %s\n", Config::WIFI_SSID);
}

void connectMqtt() {
  if (!wifiConnected() || gMqttClient.connected()) {
    return;
  }

  const unsigned long nowMs = millis();
  if ((nowMs - gLastMqttAttemptMs) < Config::MQTT_RECONNECT_INTERVAL_MS) {
    return;
  }

  gLastMqttAttemptMs = nowMs;
  Serial.printf("[mqtt] connecting to %s:%u\n", Config::MQTT_HOST, Config::MQTT_PORT);

  const bool connected = Config::MQTT_USE_AUTH
                             ? gMqttClient.connect(
                                   Config::DEVICE_ID, Config::MQTT_USERNAME,
                                   Config::MQTT_PASSWORD, gStatusTopic.c_str(), 0, true,
                                   "offline")
                             : gMqttClient.connect(Config::DEVICE_ID, gStatusTopic.c_str(), 0,
                                                   true, "offline");

  if (connected) {
    Serial.println("[mqtt] connected");
    publishStatus(true);
    gLastEvent = "mqtt.online";
    gMirrorState.lastAction = gLastEvent;
  } else {
    Serial.printf("[mqtt] connect failed rc=%d\n", gMqttClient.state());
  }
}

void pollConsoleState() {
  if (!wifiConnected()) {
    resetMirrorState();
    return;
  }

  const unsigned long nowMs = millis();
  if ((nowMs - gLastStatePollMs) < Config::CONSOLE_STATE_POLL_INTERVAL_MS) {
    return;
  }

  gLastStatePollMs = nowMs;

  HTTPClient http;
  http.begin(backendUrl("/api/console/state"));
  const int statusCode = http.GET();
  if (statusCode != HTTP_CODE_OK) {
    http.end();
    resetMirrorState();
    return;
  }

  StaticJsonDocument<2048> document;
  const DeserializationError error = deserializeJson(document, http.getStream());
  http.end();
  if (error) {
    Serial.printf("[http] console state parse failed: %s\n", error.c_str());
    resetMirrorState();
    return;
  }

  gMirrorState.backendReachable = true;
  gMirrorState.interactiveActive =
      document["interactiveActive"].as<bool>() || document["active"].as<bool>();
  gMirrorState.activePageId = String(document["activePageId"] | "dynamic");
  gMirrorState.pageTitle =
      String(document["pageTitle"] | (gMirrorState.interactiveActive ? "Interactive" : "Smart Mirror"));
  gMirrorState.statusLabel = String(document["statusLabel"] | "Ready");
  gMirrorState.lastAction = String(document["lastAction"] | gLastEvent);

  JsonObject softButtons = document["softButtons"].as<JsonObject>();
  if (!softButtons.isNull()) {
    gMirrorState.button1 = String(softButtons["button1"] | gMirrorState.button1);
    gMirrorState.button2 = String(softButtons["button2"] | gMirrorState.button2);
    gMirrorState.button3 = String(softButtons["button3"] | gMirrorState.button3);
    gMirrorState.button4 = String(softButtons["button4"] | gMirrorState.button4);
    gMirrorState.dial = String(softButtons["dial"] | gMirrorState.dial);
  }
}

void renderDisplay() {
  if (!gDisplayReady) {
    return;
  }

  const unsigned long nowMs = millis();
  if ((nowMs - gLastOledRenderMs) < Config::OLED_REFRESH_INTERVAL_MS) {
    return;
  }

  gLastOledRenderMs = nowMs;
  gDisplay.clearDisplay();
  gDisplay.setTextSize(1);
  gDisplay.setTextColor(SSD1306_WHITE);

  gDisplay.setCursor(0, 0);
  gDisplay.print(clipLine(gMirrorState.pageTitle, 12));
  gDisplay.setCursor(84, 0);
  gDisplay.printf("%c%c%c", wifiConnected() ? 'W' : '-', gMqttClient.connected() ? 'M' : '-',
                  gMirrorState.backendReachable ? 'B' : '-');
  gDisplay.drawLine(0, 10, Config::SCREEN_WIDTH - 1, 10, SSD1306_WHITE);

  gDisplay.setCursor(0, 14);
  gDisplay.print(clipLine(gMirrorState.statusLabel));

  gDisplay.setCursor(0, 24);
  gDisplay.print(clipLine(gMirrorState.lastAction));

  gDisplay.setCursor(0, 34);
  gDisplay.print(clipLine(String("Dial: ") + gMirrorState.dial));

  gDisplay.setCursor(0, 44);
  gDisplay.print(clipLine(String("1 ") + gMirrorState.button1 + "  2 " + gMirrorState.button2));

  gDisplay.setCursor(0, 54);
  gDisplay.print(clipLine(String("3 ") + gMirrorState.button3 + "  4 " + gMirrorState.button4));

  gDisplay.display();
}

void pollButtons() {
  const unsigned long nowMs = millis();

  for (ButtonState& button : gButtons) {
    const bool rawPressed = digitalRead(button.pin) == LOW;

    if (rawPressed != button.lastRawPressed) {
      button.lastRawPressed = rawPressed;
      button.lastChangeMs = nowMs;
    }

    if ((nowMs - button.lastChangeMs) < Config::BUTTON_DEBOUNCE_MS) {
      continue;
    }

    if (rawPressed != button.stablePressed) {
      button.stablePressed = rawPressed;
      if (button.stablePressed) {
        button.pressedAtMs = nowMs;
        button.longSent = false;
      } else if (!button.longSent) {
        publishAction(button.command, false);
      }
    }

    if (button.stablePressed && !button.longSent &&
        (nowMs - button.pressedAtMs) >= Config::BUTTON_LONG_PRESS_MS) {
      button.longSent = true;
      publishAction(button.command, true);
    }
  }
}

void pollMotion() {
  const unsigned long nowMs = millis();
  const bool motionHigh = digitalRead(Pins::PIR_MOTION) == HIGH;

  if (motionHigh) {
    gLastMotionMs = nowMs;
    if (!gMotionActive) {
      gMotionActive = true;
      publishMotion("motion.active");
    }
    return;
  }

  if (gMotionActive && (nowMs - gLastMotionMs) >= Config::MOTION_IDLE_TIMEOUT_MS) {
    gMotionActive = false;
    publishMotion("motion.idle");
  }
}

void pollDial() {
  const unsigned long nowMs = millis();
  const int reading = analogRead(Pins::POTENTIOMETER);
  if (abs(reading - gLastDialReading) < Config::POT_MIN_DELTA) {
    return;
  }

  const int bucket = reading / Config::POT_STEP_SIZE;
  if (bucket == gLastDialBucket) {
    gLastDialReading = reading;
    return;
  }

  if ((nowMs - gLastDialEmitMs) < Config::DIAL_EMIT_COOLDOWN_MS) {
    gLastDialReading = reading;
    return;
  }

  gLastDialEmitMs = nowMs;
  gLastDialReading = reading;
  const int delta = (bucket > gLastDialBucket) ? 1 : -1;
  gLastDialBucket = bucket;
  publishAdjust(delta);
}

void initializeButtons() {
  for (ButtonState& button : gButtons) {
    pinMode(button.pin, INPUT_PULLUP);
    const bool pressed = digitalRead(button.pin) == LOW;
    button.stablePressed = pressed;
    button.lastRawPressed = pressed;
    button.lastChangeMs = millis();
    button.pressedAtMs = 0;
    button.longSent = false;
  }
}

void initializeDisplay() {
  Wire.begin(Pins::OLED_SDA, Pins::OLED_SCL);
  gDisplayReady = gDisplay.begin(SSD1306_SWITCHCAPVCC, Config::OLED_ADDRESS);
  if (!gDisplayReady) {
    Serial.println("[oled] initialization failed");
    return;
  }

  gDisplay.clearDisplay();
  gDisplay.display();
}
}  // namespace

void setup() {
  Serial.begin(115200);
  delay(250);
  Serial.println();
  Serial.println("[boot] smart mirror esp32 console");

  gEventTopic = String(Config::MQTT_TOPIC_PREFIX) + "/" + Config::DEVICE_ID + "/event";
  gStatusTopic = String(Config::MQTT_TOPIC_PREFIX) + "/" + Config::DEVICE_ID + "/status";

  pinMode(Pins::PIR_MOTION, INPUT);
  analogReadResolution(12);
  gLastDialReading = analogRead(Pins::POTENTIOMETER);
  gLastDialBucket = gLastDialReading / Config::POT_STEP_SIZE;

  initializeButtons();
  initializeDisplay();
  resetMirrorState();

  gMqttClient.setServer(Config::MQTT_HOST, Config::MQTT_PORT);
  gMqttClient.setBufferSize(512);
}

void loop() {
  connectWiFi();
  connectMqtt();

  if (gMqttClient.connected()) {
    gMqttClient.loop();
  }

  pollConsoleState();
  pollButtons();
  pollMotion();
  pollDial();
  renderDisplay();
}
