#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFiClient.h>

class MqttManager {
 public:
  void begin();
  void loop();
  bool isConnected() const;
  bool publishStatus(bool online);
  bool publishEvent(const char* type, const JsonDocument& payload);
  bool publishEvent(const char* type);

 private:
  WiFiClient wifiClient_;
  PubSubClient client_{wifiClient_};
  unsigned long lastAttemptMs_ = 0;
  String eventTopic_;
  String statusTopic_;

  void connect();
  void configureTopics();
};
