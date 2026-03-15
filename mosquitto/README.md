MQTT broker credentials are local-only and come from `backend/.env`.

Required local variables:

- `MQTT_USERNAME`
- `MQTT_PASSWORD`

The compose service generates an in-memory Mosquitto password file at startup, so no broker password file is tracked in git.
The ESP32 `include/config.local.h` values for `MQTT_USERNAME`, `MQTT_PASSWORD`, and `MQTT_USE_AUTH` must match `backend/.env`.
