# AI Tool Mapping

## Current Stack Map

| Area | Technology | Current Use |
|------|------------|-------------|
| Backend | Node.js + Express + ws + mqtt | API, auth/session, websocket, scene/console state, ESP32 input processing |
| Display | React + Vite | Mirror UI (home/fun/spotify + standby) |
| Mobile PWA | React + Vite | Admin/mobile control app, built into backend/public |
| Camera Sidecar | Python service | Camera stream and camera enable/disable integration |
| Sensor Sidecar | Python service | DHT22 temperature/humidity readings |
| ESP32 Firmware | Arduino + PubSubClient + SSD1306 | OLED rendering, button/PIR publish, console polling |
| MQTT Broker | Mosquitto | Internal ESP32 event transport |

## What Is Actively Used

- Display page sync over websocket with allowed pages home/fun/spotify
- PWA auth/session flow and admin-protected write actions
- ESP32 event path using mqtt topics smartmirror/esp32/<device>/event and /status
- OLED state path through GET /api/console/state?device=esp32
- camera/privacy/standby coordination from backend state

## Practical Notes

- This repository contains AI-assisted generated code that has been iterated with hardware validation.
- Documentation should prioritize current running behavior over historical implementation notes.
- If architecture changes, update README, DESIGN, and TESTING together to avoid drift.

## Document Metadata

- Version: 1.1
- Last Updated: March 18, 2026
