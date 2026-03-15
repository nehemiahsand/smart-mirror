#pragma once

#include <Arduino.h>

namespace Config {
constexpr char DEVICE_ID[] = "mirror-entry-1";

constexpr char WIFI_SSID[] = "YOUR_WIFI_SSID";
constexpr char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";

constexpr char MQTT_HOST[] = "192.168.1.100";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char MQTT_USERNAME[] = "YOUR_MQTT_USERNAME";
constexpr char MQTT_PASSWORD[] = "YOUR_MQTT_PASSWORD";
constexpr bool MQTT_USE_AUTH = true;
constexpr char MQTT_TOPIC_PREFIX[] = "smartmirror/esp32";

constexpr char BACKEND_BASE_URL[] = "http://192.168.1.100";

constexpr unsigned long WIFI_RECONNECT_INTERVAL_MS = 10000UL;
constexpr unsigned long MQTT_RECONNECT_INTERVAL_MS = 5000UL;
constexpr unsigned long BUTTON_DEBOUNCE_MS = 35UL;
constexpr unsigned long BUTTON_LONG_PRESS_MS = 800UL;
constexpr unsigned long MOTION_IDLE_TIMEOUT_MS = 90000UL;
constexpr unsigned long DIAL_EMIT_COOLDOWN_MS = 180UL;
constexpr unsigned long CONSOLE_STATE_POLL_INTERVAL_MS = 2000UL;
constexpr unsigned long OLED_REFRESH_INTERVAL_MS = 150UL;

constexpr int SCREEN_WIDTH = 128;
constexpr int SCREEN_HEIGHT = 32;
constexpr int OLED_ADDRESS = 0x3C;
constexpr int POT_MIN_DELTA = 80;
constexpr int POT_STEP_SIZE = 96;
}  // namespace Config
