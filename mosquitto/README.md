# Mosquitto Service

The Compose stack includes an authenticated Mosquitto broker for the ESP32 console.

## Current Behavior

- container name: `smart-mirror-mosquitto`
- host port: `1883`
- config file: `mosquitto/mosquitto.conf`
- password file: generated at container startup, not tracked in git

## Required Local Variables

These values come from `backend/.env`:

- `MQTT_USERNAME`
- `MQTT_PASSWORD`

The startup command creates `/mosquitto/data/mosquitto.passwd` in tmpfs from those env vars.

## Current Topic Usage

The backend subscribes to:

- `smartmirror/esp32/+/event`
- `smartmirror/esp32/+/status`

The ESP32 publishes to:

- `smartmirror/esp32/<deviceId>/event`
- `smartmirror/esp32/<deviceId>/status`

## Security Notes

- anonymous access is disabled
- no tracked password file is stored in the repo
- broker credentials must match the ESP32 local config in `esp32-console/include/config.local.h`
- the broker is intended for the mirror stack and ESP32 console, not general public use
