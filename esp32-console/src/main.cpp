#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <DHTesp.h>
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
constexpr uint8_t BUTTON_5 = 23;
constexpr uint8_t PIR_MOTION = 33;
constexpr uint8_t OLED_SDA = 21;
constexpr uint8_t OLED_SCL = 22;
constexpr uint8_t DHT22_DATA = 14;
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
  String statsLine4 = "";
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
DHTesp gDht22;

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
uint8_t gStatsPageIndex = 0;

unsigned long gLastWifiAttemptMs = 0;
unsigned long gLastMqttAttemptMs = 0;
unsigned long gLastStatePollMs = 0;
unsigned long gLastOledRenderMs = 0;
unsigned long gLastMotionMs = 0;
unsigned long gLastClimatePublishMs = 0;
bool gClimateReady = false;
constexpr unsigned long CLIMATE_PUBLISH_INTERVAL_MS = 30000UL;

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

int16_t getHeaderHeight() { return isCompactScreen() ? 9 : 12; }

int16_t measureTextWidth(const String& value) {
  int16_t x1 = 0;
  int16_t y1 = 0;
  uint16_t width = 0;
  uint16_t height = 0;
  gDisplay.getTextBounds(value, 0, 0, &x1, &y1, &width, &height);
  return static_cast<int16_t>(width);
}

int16_t measureTextWidthWithSize(const String& value, uint8_t textSize) {
  gDisplay.setTextSize(textSize);
  const int16_t width = measureTextWidth(value);
  gDisplay.setTextSize(1);
  return width;
}

String abbreviateLabel(const String& value) {
  if (value == "Play/Pause") {
    return "Play";
  }

  if (value == "Previous") {
    return "Prev";
  }

  if (value == "Default") {
    return "Home";
  }

  if (value == "Main Page") {
    return "Home";
  }

  if (value == "Turn On") {
    return "Wake";
  }

  return value;
}

String fitTextToWidth(const String& value, int16_t maxWidth, size_t maxLength = 20,
                      bool abbreviate = true) {
  if (value.isEmpty() || maxWidth <= 0) {
    return "";
  }

  String fitted = abbreviate ? abbreviateLabel(value) : value;
  fitted = clipLine(fitted, maxLength);

  if (measureTextWidth(fitted) <= maxWidth) {
    return fitted;
  }

  if (measureTextWidth("~") > maxWidth) {
    return "";
  }

  String trimmed = fitted;
  while (trimmed.length() > 1) {
    trimmed = trimmed.substring(0, trimmed.length() - 1);
    const String candidate = trimmed + "~";
    if (measureTextWidth(candidate) <= maxWidth) {
      return candidate;
    }
  }

  return "";
}

String fitTextToWidthSized(const String& value, int16_t maxWidth, uint8_t textSize,
                           size_t maxLength = 20, bool abbreviate = true) {
  gDisplay.setTextSize(textSize);
  const String fitted = fitTextToWidth(value, maxWidth, maxLength, abbreviate);
  gDisplay.setTextSize(1);
  return fitted;
}

String backendUrl(const char* path) {
  return String(Config::BACKEND_BASE_URL) + path;
}

bool wifiConnected() { return WiFi.status() == WL_CONNECTED; }

uint8_t getStatsPageCount() {
  uint8_t count = 0;
  if (!gMirrorState.statsLine1.isEmpty()) {
    count += 1;
  }
  if (!gMirrorState.statsLine2.isEmpty()) {
    count += 1;
  }
  if (!gMirrorState.statsLine3.isEmpty()) {
    count += 1;
  }
  if (!gMirrorState.statsLine4.isEmpty()) {
    count += 1;
  }
  return count;
}

String getStatsPageLine(uint8_t index) {
  const String lines[] = {
      gMirrorState.statsLine1,
      gMirrorState.statsLine2,
      gMirrorState.statsLine3,
      gMirrorState.statsLine4,
  };

  uint8_t currentIndex = 0;
  for (const String& line : lines) {
    if (line.isEmpty()) {
      continue;
    }

    if (currentIndex == index) {
      return line;
    }

    currentIndex += 1;
  }

  return "";
}

String extractStatValue(const String& line, const String& label, const String& nextLabel = "") {
  const String prefix = label + " ";
  const int start = line.indexOf(prefix);
  if (start < 0) {
    return "";
  }

  const int valueStart = start + prefix.length();
  if (nextLabel.isEmpty()) {
    return line.substring(valueStart);
  }

  const int nextStart = line.indexOf(String(" ") + nextLabel + " ", valueStart);
  if (nextStart < 0) {
    return line.substring(valueStart);
  }

  return line.substring(valueStart, nextStart);
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
  gMirrorState.statsLine4 = "";
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

void pollClimate() {
  const unsigned long nowMs = millis();
  if ((nowMs - gLastClimatePublishMs) < CLIMATE_PUBLISH_INTERVAL_MS) {
    return;
  }
  gLastClimatePublishMs = nowMs;

  if (!gClimateReady) {
    return;
  }

  const TempAndHumidity reading = gDht22.getTempAndHumidity();
  if (isnan(reading.temperature) || isnan(reading.humidity)) {
    Serial.println("[climate] DHT22 read failed");
    return;
  }

  const float tempC = reading.temperature;
  const float tempF = (tempC * 9.0f / 5.0f) + 32.0f;
  StaticJsonDocument<160> payload;
  payload["temperatureCelsius"] = tempC;
  payload["temperatureFahrenheit"] = tempF;
  payload["humidity"] = reading.humidity;
  payload["units"] = "metric";

  if (publishJson("climate.reading", payload)) {
    Serial.printf("[climate] published %.1fC %.1fF %.1f%%\n", tempC, tempF, reading.humidity);
  } else {
    Serial.println("[climate] publish skipped (mqtt disconnected)");
  }
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

  StaticJsonDocument<1536> document;
  const DeserializationError error = deserializeJson(document, http.getStream());
  http.end();
  if (error) {
    Serial.printf("[http] console state parse failed: %s\n", error.c_str());
    markBackendUnavailable();
    return;
  }

  const bool wasStatsScreen = gMirrorState.screenMode == "stats";

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
  gMirrorState.statsLine4 = String(document["statsLine4"] | "");

  const uint8_t statsPageCount = getStatsPageCount();
  if (!wasStatsScreen && gMirrorState.screenMode == "stats") {
    gStatsPageIndex = 0;
  } else if (statsPageCount == 0) {
    gStatsPageIndex = 0;
  } else if (gStatsPageIndex >= statsPageCount) {
    gStatsPageIndex = statsPageCount - 1;
  }

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
  const String status =
      String(wifiConnected() ? 'W' : '-') + String(gMqttClient.connected() ? 'M' : '-') +
      String(gMirrorState.backendReachable ? 'B' : '-');
  const int16_t headerHeight = getHeaderHeight();
  const int16_t statusWidth = measureTextWidth(status);
  const int16_t rightPadding = 3;
  const int16_t titleMaxWidth =
      Config::SCREEN_WIDTH - statusWidth - (rightPadding * 3) - 2;
  const String headerTitle = fitTextToWidth(title, titleMaxWidth, 20, false);

  gDisplay.fillRect(0, 0, Config::SCREEN_WIDTH, headerHeight, SSD1306_WHITE);
  gDisplay.setTextColor(SSD1306_BLACK);
  gDisplay.setCursor(3, isCompactScreen() ? 1 : 2);
  gDisplay.print(headerTitle);
  gDisplay.setCursor(Config::SCREEN_WIDTH - statusWidth - rightPadding, isCompactScreen() ? 1 : 2);
  gDisplay.print(status);
  gDisplay.setTextColor(SSD1306_WHITE);
}

void drawCenteredText(int16_t x, int16_t y, int16_t width, int16_t height, const String& value) {
  if (value.isEmpty()) {
    return;
  }

  const int16_t textWidth = measureTextWidth(value);
  const int16_t textX = x + max<int16_t>(0, (width - textWidth) / 2);
  const int16_t textY = y + max<int16_t>(1, (height - 8) / 2);
  gDisplay.setCursor(textX, textY);
  gDisplay.print(value);
}

void drawCenteredTextSized(int16_t x, int16_t y, int16_t width, int16_t height, const String& value,
                           uint8_t textSize) {
  if (value.isEmpty()) {
    return;
  }

  gDisplay.setTextSize(textSize);
  const int16_t textWidth = measureTextWidth(value);
  const int16_t textHeight = 8 * textSize;
  const int16_t textX = x + max<int16_t>(0, (width - textWidth) / 2);
  const int16_t textY = y + max<int16_t>(0, (height - textHeight) / 2);
  gDisplay.setCursor(textX, textY);
  gDisplay.print(value);
  gDisplay.setTextSize(1);
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

void drawButtonCard(
    int16_t x, int16_t y, int16_t width, int16_t height, uint8_t buttonNumber, const String& label,
    size_t maxLength = 20) {
  if (label.isEmpty()) {
    return;
  }

  const int16_t badgeWidth = 11;
  const String cardLabel =
      fitTextToWidth(label, width - badgeWidth - 6, maxLength);

  gDisplay.drawRoundRect(x, y, width, height, 2, SSD1306_WHITE);
  gDisplay.fillRect(x + 1, y + 1, badgeWidth - 1, height - 2, SSD1306_WHITE);
  gDisplay.setTextColor(SSD1306_BLACK);
  drawCenteredText(x + 1, y + 1, badgeWidth - 1, height - 2, String(buttonNumber));
  gDisplay.setTextColor(SSD1306_WHITE);
  drawCenteredText(x + badgeWidth + 1, y, width - badgeWidth - 3, height, cardLabel);
}

void drawMessageCard(int16_t x, int16_t y, int16_t width, int16_t height, const String& value,
                     size_t maxLength = 20) {
  if (value.isEmpty()) {
    return;
  }

  gDisplay.drawRoundRect(x, y, width, height, 2, SSD1306_WHITE);
  drawCenteredText(x + 2, y, width - 4, height, fitTextToWidth(value, width - 8, maxLength));
}

void drawCompactButtonGrid(bool showExtendedControls) {
  const int16_t contentY = 10;
  const int16_t rowHeight = 8;
  const int16_t gap = 2;
  const int16_t halfWidth = (Config::SCREEN_WIDTH - gap) / 2;

  if (showExtendedControls) {
    drawButtonCard(0, contentY, halfWidth, rowHeight, 1, gMirrorState.button1, 8);
    drawButtonCard(halfWidth + gap, contentY, Config::SCREEN_WIDTH - halfWidth - gap, rowHeight, 5,
                   gMirrorState.button5, 8);
    drawButtonCard(0, contentY + rowHeight, halfWidth, rowHeight, 2, gMirrorState.button2, 8);
    drawButtonCard(halfWidth + gap, contentY + rowHeight,
                   Config::SCREEN_WIDTH - halfWidth - gap, rowHeight, 3, gMirrorState.button3, 8);
    drawButtonCard(0, contentY + (rowHeight * 2), Config::SCREEN_WIDTH, rowHeight, 4,
                   gMirrorState.button4, 16);
    return;
  }

  drawMessageCard(0, contentY, Config::SCREEN_WIDTH, rowHeight, gMirrorState.statusLabel, 20);
  drawButtonCard(0, contentY + rowHeight, Config::SCREEN_WIDTH, rowHeight, 1, gMirrorState.button1, 18);
  if (!gMirrorState.button5.isEmpty()) {
    drawButtonCard(0, contentY + (rowHeight * 2), Config::SCREEN_WIDTH, rowHeight, 5,
                   gMirrorState.button5, 18);
  } else {
    drawMessageCard(0, contentY + (rowHeight * 2), Config::SCREEN_WIDTH, rowHeight,
                    gMirrorState.lastAction, 20);
  }
}

void renderStandbyScreen() {
  renderHeader("Standby");
  if (isCompactScreen()) {
    drawCompactButtonGrid(false);
    return;
  }

  drawMessageCard(0, 15, Config::SCREEN_WIDTH, 14, gMirrorState.statusLabel);
  drawButtonCard(0, 33, Config::SCREEN_WIDTH, 13, 1, gMirrorState.button1, 18);
  drawButtonCard(0, 49, Config::SCREEN_WIDTH, 13, 5, gMirrorState.button5, 18);
}

void renderStatsScreen() {
  const uint8_t statsPageCount = getStatsPageCount();
  const String statsLine = statsPageCount == 0 ? "No stats" : getStatsPageLine(gStatsPageIndex);
  const String diskValue = extractStatValue(gMirrorState.statsLine1, "Disk", "Ping");
  const String pingValue = extractStatValue(gMirrorState.statsLine1, "Ping");
  const String cpuValue = extractStatValue(gMirrorState.statsLine2, "CPU", "RAM");
  const String ramValue = extractStatValue(gMirrorState.statsLine2, "RAM");
  const String uptimeValue = extractStatValue(gMirrorState.statsLine3, "Up", "T");
  const String tempValue = extractStatValue(gMirrorState.statsLine3, "T");
  const String motionValue = extractStatValue(gMirrorState.statsLine4, "Motion");
  const int16_t contentTop = getHeaderHeight() + 1;

  if (gStatsPageIndex == 0 && !diskValue.isEmpty()) {
    renderHeader("Disk / Ping");
    gDisplay.setCursor(8, contentTop);
    gDisplay.print("DISK");
    gDisplay.setCursor(76, contentTop);
    gDisplay.print("PING");
    gDisplay.drawLine(63, contentTop + 1, 63, Config::SCREEN_HEIGHT - 1, SSD1306_WHITE);
    drawCenteredTextSized(0, contentTop + 7, 62, Config::SCREEN_HEIGHT - (contentTop + 7),
                          fitTextToWidthSized(diskValue, 56, 2), 2);
    drawCenteredTextSized(66, contentTop + 7, 62, Config::SCREEN_HEIGHT - (contentTop + 7),
                          fitTextToWidthSized(pingValue, 56, 2), 2);
    return;
  }

  if (gStatsPageIndex == 1 && !cpuValue.isEmpty()) {
    renderHeader("CPU / RAM");
    gDisplay.setCursor(10, contentTop);
    gDisplay.print("CPU");
    gDisplay.setCursor(78, contentTop);
    gDisplay.print("RAM");
    gDisplay.drawLine(63, contentTop + 1, 63, Config::SCREEN_HEIGHT - 1, SSD1306_WHITE);
    drawCenteredTextSized(0, contentTop + 7, 62, Config::SCREEN_HEIGHT - (contentTop + 7),
                          fitTextToWidthSized(cpuValue, 56, 2), 2);
    drawCenteredTextSized(66, contentTop + 7, 62, Config::SCREEN_HEIGHT - (contentTop + 7),
                          fitTextToWidthSized(ramValue, 56, 2), 2);
    return;
  }

  if (gStatsPageIndex == 2 && !uptimeValue.isEmpty()) {
    renderHeader("Uptime");
    if (!tempValue.isEmpty()) {
      gDisplay.drawRoundRect(82, contentTop, 42, 9, 2, SSD1306_WHITE);
      drawCenteredText(84, contentTop, 38, 9, fitTextToWidth(tempValue, 36));
    }

    gDisplay.setCursor(4, contentTop + 1);
    gDisplay.print("UP");
    drawCenteredTextSized(0, contentTop + 8, Config::SCREEN_WIDTH,
                          Config::SCREEN_HEIGHT - (contentTop + 8),
                          fitTextToWidthSized(uptimeValue, Config::SCREEN_WIDTH - 8, 2, 20, false), 2);
    return;
  }

  if (gStatsPageIndex == 3 && !motionValue.isEmpty()) {
    const bool motionDetected = motionValue == "Yes";
    renderHeader("Motion");
    if (motionDetected) {
      gDisplay.fillRoundRect(12, contentTop + 4, 104, 17, 3, SSD1306_WHITE);
      gDisplay.setTextColor(SSD1306_BLACK);
      drawCenteredTextSized(12, contentTop + 4, 104, 17, "YES", 2);
      gDisplay.setTextColor(SSD1306_WHITE);
    } else {
      gDisplay.drawRoundRect(12, contentTop + 4, 104, 17, 3, SSD1306_WHITE);
      drawCenteredTextSized(12, contentTop + 4, 104, 17, "NO", 2);
    }
    return;
  }

  renderHeader(String("Stats ") + String(statsPageCount == 0 ? 0 : gStatsPageIndex + 1) +
               "/" + String(statsPageCount == 0 ? 0 : statsPageCount));
  drawMessageCard(0, 10, Config::SCREEN_WIDTH, Config::SCREEN_HEIGHT - 10, statsLine, 20);
}

void renderPageScreen() {
  renderHeader(gMirrorState.pageTitle);
  const bool showExtendedControls =
      gMirrorState.activePageId == "spotify" || gMirrorState.activePageId == "fun" ||
      gMirrorState.activePageId == "home";

  if (isCompactScreen()) {
    drawCompactButtonGrid(showExtendedControls);
    return;
  }

  if (showExtendedControls) {
    const int16_t topWidth = (Config::SCREEN_WIDTH - 2) / 2;
    const int16_t bottomWidth = (Config::SCREEN_WIDTH - 4) / 3;
    drawButtonCard(0, 15, topWidth, 21, 1, gMirrorState.button1, 10);
    drawButtonCard(topWidth + 2, 15, Config::SCREEN_WIDTH - topWidth - 2, 21, 5,
                   gMirrorState.button5, 10);
    drawButtonCard(0, 40, bottomWidth, 24, 2, gMirrorState.button2, 8);
    drawButtonCard(bottomWidth + 2, 40, bottomWidth, 24, 3, gMirrorState.button3, 8);
    drawButtonCard((bottomWidth * 2) + 4, 40, Config::SCREEN_WIDTH - ((bottomWidth * 2) + 4), 24,
                   4, gMirrorState.button4, 8);
    return;
  }

  drawMessageCard(0, 15, Config::SCREEN_WIDTH, 14, gMirrorState.statusLabel);
  drawButtonCard(0, 33, Config::SCREEN_WIDTH, 13, 1, gMirrorState.button1, 18);
  if (!gMirrorState.button5.isEmpty()) {
    drawButtonCard(0, 49, Config::SCREEN_WIDTH, 13, 5, gMirrorState.button5, 18);
  } else {
    drawMessageCard(0, 49, Config::SCREEN_WIDTH, 13, gMirrorState.lastAction);
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
        if (gMirrorState.screenMode == "stats") {
          const uint8_t statsPageCount = getStatsPageCount();
          if (button.command == ButtonCommand::Primary && statsPageCount > 1) {
            gStatsPageIndex = gStatsPageIndex == 0 ? statsPageCount - 1 : gStatsPageIndex - 1;
            gLastOledRenderMs = 0;
            continue;
          }

          if (button.command == ButtonCommand::Previous && statsPageCount > 1) {
            gStatsPageIndex = (gStatsPageIndex + 1) % statsPageCount;
            gLastOledRenderMs = 0;
            continue;
          }

          if (button.command == ButtonCommand::TogglePage || button.command == ButtonCommand::Next) {
            continue;
          }
        }

        publishAction(button, false);
      }
    }

    if (button.stablePressed && !button.longSent &&
        (nowMs - button.pressedAtMs) >= Config::BUTTON_LONG_PRESS_MS) {
      button.longSent = true;
      if (gMirrorState.screenMode == "stats") {
        continue;
      }

      publishAction(button, true);
    }
  }
}

void pollMotion() {
  const unsigned long nowMs = millis();
  const bool motionHigh = digitalRead(Pins::PIR_MOTION) == HIGH;

  if (nowMs % 1000 == 0) { // Debug log for user to check sensor readout
    static bool lastDebugHigh = false;
    if (motionHigh != lastDebugHigh) {
      Serial.printf("[debug] PIR sensor raw value changed to: %s\n", motionHigh ? "HIGH" : "LOW");
      lastDebugHigh = motionHigh;
    }
  }

  if (motionHigh) {
    gLastMotionMs = nowMs;
    if (!gMotionActive) {
      gMotionActive = true;
      Serial.println("[motion] Transitioned to ACTIVE state!");
      publishMotion("motion.active");
    }
    return;
  }

  if (gMotionActive && (nowMs - gLastMotionMs) >= Config::MOTION_IDLE_TIMEOUT_MS) {
    gMotionActive = false;
    Serial.println("[motion] Idle timeout reached. Transitioned to IDLE.");
    publishMotion("motion.idle");
  }
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

  pinMode(Pins::PIR_MOTION, INPUT_PULLDOWN); // Ensure sensor isn't floating
  initializeButtons();
  initializeDisplay();
  resetMirrorState();

  gMqttClient.setServer(Config::MQTT_HOST, Config::MQTT_PORT);
  gMqttClient.setBufferSize(512);

  gDht22.setup(Pins::DHT22_DATA, DHTesp::DHT22);
  gClimateReady = true;
  gLastClimatePublishMs = millis();
  Serial.printf("[climate] DHT22 initialized on GPIO%d\n", Pins::DHT22_DATA);
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
  pollClimate();
  renderDisplay();
}
