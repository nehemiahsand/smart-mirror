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
constexpr uint8_t BUTTON_1 = 32;
constexpr uint8_t BUTTON_2 = 26;
constexpr uint8_t BUTTON_3 = 27;
constexpr uint8_t BUTTON_4 = 25;
constexpr uint8_t BUTTON_5 = 34;
constexpr uint8_t PIR_MOTION = 33;
constexpr uint8_t OLED_SDA = 21;
constexpr uint8_t OLED_SCL = 22;
}  // namespace Pins

enum class ButtonCommand : uint8_t {
  TogglePage = 0,
  Previous = 1,
  Primary = 2,
  Next = 3,
  Back = 4,
};

struct ButtonState {
  uint8_t pin;
  const char* id;
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
  bool standby = false;
  String activePageId = "home";
  String screenMode = "page";
  String pageTitle = "Main Page";
  String statusLabel = "Waiting for backend";
  String lastAction = "Booting";
  String statsLine1 = "";
  String statsLine2 = "";
  String statsLine3 = "";
  String button1 = "Spotify";
  String button2 = "Play/Pause";
  String button3 = "Prev";
  String button4 = "Next";
  String button5 = "";
};

namespace {
Adafruit_SSD1306 gDisplay(Config::SCREEN_WIDTH, Config::SCREEN_HEIGHT, &Wire, -1);
WiFiClient gWiFiClient;
PubSubClient gMqttClient(gWiFiClient);

ButtonState gButtons[] = {
    {Pins::BUTTON_1, "button1", ButtonCommand::TogglePage, false, false, false, 0, 0},
    {Pins::BUTTON_2, "button2", ButtonCommand::Primary, false, false, false, 0, 0},
    {Pins::BUTTON_3, "button3", ButtonCommand::Previous, false, false, false, 0, 0},
    {Pins::BUTTON_4, "button4", ButtonCommand::Next, false, false, false, 0, 0},
    {Pins::BUTTON_5, "button5", ButtonCommand::Back, false, false, false, 0, 0},
};

MirrorState gMirrorState;
bool gHasConsoleState = false;

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

const char* buttonAction(ButtonCommand command) {
  switch (command) {
    case ButtonCommand::TogglePage:
      return "toggle_page";
    case ButtonCommand::Previous:
      return "previous";
    case ButtonCommand::Primary:
      return "primary";
    case ButtonCommand::Next:
      return "next";
    case ButtonCommand::Back:
      return "back";
    default:
      return "primary";
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

bool isCompactScreen() { return Config::SCREEN_HEIGHT <= 32; }

String backendUrl(const char* path) {
  return String(Config::BACKEND_BASE_URL) + path;
}

bool wifiConnected() { return WiFi.status() == WL_CONNECTED; }

void buildConsoleStateFilter(JsonDocument& filter) {
  filter["interactiveActive"] = true;
  filter["active"] = true;
  filter["standby"] = true;
  filter["screenMode"] = true;
  filter["activePageId"] = true;
  filter["pageTitle"] = true;
  filter["statusLabel"] = true;
  filter["lastAction"] = true;
  filter["statsLine1"] = true;
  filter["statsLine2"] = true;
  filter["statsLine3"] = true;

  JsonObject softButtons = filter["softButtons"].to<JsonObject>();
  softButtons["button1"] = true;
  softButtons["button2"] = true;
  softButtons["button3"] = true;
  softButtons["button4"] = true;
  softButtons["button5"] = true;
}

void resetMirrorState() {
  gMirrorState.backendReachable = false;
  gMirrorState.interactiveActive = false;
  gMirrorState.standby = false;
  gMirrorState.activePageId = "home";
  gMirrorState.screenMode = "page";
  gMirrorState.pageTitle = "Main Page";
  gMirrorState.statusLabel = wifiConnected() ? "Waiting for backend" : "Waiting for WiFi";
  gMirrorState.lastAction = gLastEvent;
  gMirrorState.statsLine1 = "";
  gMirrorState.statsLine2 = "";
  gMirrorState.statsLine3 = "";
  gMirrorState.button1 = "Spotify";
  gMirrorState.button2 = "Play/Pause";
  gMirrorState.button3 = "Prev";
  gMirrorState.button4 = "Next";
  gMirrorState.button5 = "";
}

void markBackendUnavailable() {
  if (!gHasConsoleState) {
    resetMirrorState();
    return;
  }

  gMirrorState.backendReachable = false;
  gMirrorState.interactiveActive = false;
  gMirrorState.statusLabel = wifiConnected() ? "Waiting for backend" : "Waiting for WiFi";
  gMirrorState.lastAction = gLastEvent;
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

bool publishAction(const ButtonState& button, bool hold) {
  const ButtonCommand command = button.command;
  if (command == ButtonCommand::TogglePage) {
    StaticJsonDocument<64> payload;
    payload["pageId"] = gMirrorState.activePageId;
    payload["hold"] = hold;
    return publishJson("display.page.toggle", payload);
  }

  StaticJsonDocument<192> payload;
  payload["pageId"] = gMirrorState.activePageId;
  payload["buttonId"] = button.id;
  payload["action"] = buttonAction(command);
  payload["hold"] = hold;
  return publishJson("ui.action", payload);
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
  http.begin(backendUrl("/api/console/state?device=esp32"));
  const int statusCode = http.GET();
  if (statusCode != HTTP_CODE_OK) {
    http.end();
    markBackendUnavailable();
    return;
  }

  StaticJsonDocument<256> filter;
  buildConsoleStateFilter(filter);

  StaticJsonDocument<1536> document;
  const DeserializationError error = deserializeJson(
      document, http.getStream(), DeserializationOption::Filter(filter));
  http.end();
  if (error) {
    Serial.printf("[http] console state parse failed: %s\n", error.c_str());
    markBackendUnavailable();
    return;
  }

  gHasConsoleState = true;
  gMirrorState.backendReachable = true;
  gMirrorState.interactiveActive = document["interactiveActive"].as<bool>() || document["active"].as<bool>();
  gMirrorState.standby = document["standby"].as<bool>();
  gMirrorState.screenMode = String(document["screenMode"] | (gMirrorState.standby ? "standby" : "page"));
  gMirrorState.activePageId = String(document["activePageId"] | "home");
  gMirrorState.pageTitle = String(document["pageTitle"] | (gMirrorState.standby ? "Standby" : "Main Page"));
  gMirrorState.statusLabel = String(document["statusLabel"] | (gMirrorState.standby ? "Motion or 1 wakes" : "Ready"));
  gMirrorState.lastAction = String(document["lastAction"] | gLastEvent);
  gMirrorState.statsLine1 = String(document["statsLine1"] | "");
  gMirrorState.statsLine2 = String(document["statsLine2"] | "");
  gMirrorState.statsLine3 = String(document["statsLine3"] | "");

  JsonObject softButtons = document["softButtons"].as<JsonObject>();
  if (!softButtons.isNull()) {
    gMirrorState.button1 = String(softButtons["button1"] | gMirrorState.button1);
    gMirrorState.button2 = String(softButtons["button2"] | gMirrorState.button2);
    gMirrorState.button3 = String(softButtons["button3"] | gMirrorState.button3);
    gMirrorState.button4 = String(softButtons["button4"] | gMirrorState.button4);
    gMirrorState.button5 = String(softButtons["button5"] | gMirrorState.button5);
  }
}

void renderHeader(const String& title) {
  gDisplay.setCursor(0, 0);
  gDisplay.print(clipLine(title, 12));
  gDisplay.setCursor(84, 0);
  gDisplay.printf("%c%c%c", wifiConnected() ? 'W' : '-', gMqttClient.connected() ? 'M' : '-',
                  gMirrorState.backendReachable ? 'B' : '-');
  gDisplay.drawLine(0, 10, Config::SCREEN_WIDTH - 1, 10, SSD1306_WHITE);
}

void drawLineIfPresent(int16_t y, const String& value, size_t maxLength = 20) {
  if (value.isEmpty()) {
    return;
  }

  gDisplay.setCursor(0, y);
  gDisplay.print(clipLine(value, maxLength));
}

void drawButtonLine(int16_t y, uint8_t buttonNumber, const String& label, size_t maxLength = 20) {
  if (label.isEmpty()) {
    return;
  }

  drawLineIfPresent(y, String(buttonNumber) + " " + label, maxLength);
}

void renderStandbyScreen() {
  renderHeader("Standby");
  if (isCompactScreen()) {
    drawButtonLine(16, 1, gMirrorState.button1, 20);
    drawButtonLine(24, 5, gMirrorState.button5, 20);
    return;
  }

  drawLineIfPresent(18, gMirrorState.statusLabel);
  drawButtonLine(42, 1, gMirrorState.button1);
  drawButtonLine(54, 5, gMirrorState.button5);
}

void renderStatsScreen() {
  renderHeader("Stats");
  if (isCompactScreen()) {
    drawLineIfPresent(16, gMirrorState.statsLine2.isEmpty() ? gMirrorState.statsLine1 : gMirrorState.statsLine2, 20);
    drawLineIfPresent(24, String("5 ") + (gMirrorState.button5.isEmpty() ? "Close" : gMirrorState.button5), 20);
    return;
  }

  drawLineIfPresent(16, gMirrorState.statsLine1);
  drawLineIfPresent(28, gMirrorState.statsLine2);
  drawLineIfPresent(40, gMirrorState.statsLine3);
  drawButtonLine(52, 5, gMirrorState.button5);
}

void renderPageScreen() {
  renderHeader(gMirrorState.pageTitle);

  if (isCompactScreen()) {
    if (gMirrorState.activePageId == "spotify") {
      drawLineIfPresent(16, String("1 ") + gMirrorState.button1 + "  5 " + gMirrorState.button5, 20);
      drawLineIfPresent(24, String("2 ") + gMirrorState.button2 + " 3 " + gMirrorState.button3 + " 4 " +
                                 gMirrorState.button4,
                        20);
      return;
    }

    drawButtonLine(16, 1, gMirrorState.button1, 20);
    drawButtonLine(24, 5, gMirrorState.button5, 20);
    return;
  }

  if (gMirrorState.activePageId == "spotify") {
    drawButtonLine(16, 1, gMirrorState.button1);
    drawButtonLine(28, 2, gMirrorState.button2);
    if (!gMirrorState.button3.isEmpty() || !gMirrorState.button4.isEmpty()) {
      drawLineIfPresent(40, String("3 ") + gMirrorState.button3 + "  4 " + gMirrorState.button4);
    }
    drawButtonLine(52, 5, gMirrorState.button5);
    return;
  }

  drawButtonLine(22, 1, gMirrorState.button1);
  drawButtonLine(44, 5, gMirrorState.button5);
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

  if (gMirrorState.screenMode == "stats") {
    renderStatsScreen();
  } else if (gMirrorState.screenMode == "standby" || gMirrorState.standby) {
    renderStandbyScreen();
  } else {
    renderPageScreen();
  }

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
        publishAction(button, false);
      }
    }

    if (button.stablePressed && !button.longSent &&
        (nowMs - button.pressedAtMs) >= Config::BUTTON_LONG_PRESS_MS) {
      button.longSent = true;
      publishAction(button, true);
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

void initializeButtons() {
  for (ButtonState& button : gButtons) {
    if (button.pin == Pins::BUTTON_5) {
      // GPIO34 is input-only on ESP32 and needs an external pull-up/down resistor.
      pinMode(button.pin, INPUT);
    } else {
      pinMode(button.pin, INPUT_PULLUP);
    }
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
  renderDisplay();
}
