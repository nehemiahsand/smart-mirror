# Smart Mirror Design

## Overview

Current system shape:

- display frontend on port 3000 (React/Vite)
- backend on port 80 (Express API + WebSocket + PWA static hosting)
- ESP32 OLED/button console using MQTT events and HTTP state polling

The backend is the source of truth for page state, standby state, console soft buttons, and scene state.

## Runtime Topology

### Containers

- mosquitto
  - authenticated MQTT broker for ESP32 topics
- sensor
  - DHT22 sidecar on internal port 5555
- camera
  - camera stream/control sidecar on internal port 5556
- backend
  - API, auth/session, scene engine, console service, WebSocket hub, and served PWA bundle
- display
  - mirror UI on port 3000

### Hardware

- Raspberry Pi 5
- DHT22 on GPIO 4
- USB camera
- USB microphone
- HDMI display
- ESP32 with five buttons, PIR sensor, and SSD1306 OLED

## Active UX Surfaces

### Mirror Display

Current synchronized pages:

- home
- fun
- spotify

Home page renders enabled widgets (time/date, weather+traffic, calendar, sports, photos).
Standby mode renders a minimal standby screen.

### Mobile/Admin PWA

Built from mobile-pwa and served by backend at /.

Current pages:

- dashboard
- wifi
- camera
- widgets
- photos
- sports
- settings
- more
- login

### ESP32 OLED Console

OLED modes:

- page
- standby
- stats

Button role model:

- button1 toggles page cycle home -> fun -> spotify -> home
- spotify page: button2 play/pause, button3 previous, button4 next
- button5 toggles stats overlay
- standby: button1 wakes display, button5 opens stats

## Backend Responsibilities

- settings persistence and redaction for sensitive fields
- admin session auth and protected write routes
- weather, traffic, sports, calendar, photos, spotify, wifi, power, camera/privacy APIs
- websocket broadcasts for settings/page/scene/console/sensor/weather changes
- esp32 mqtt ingestion and event handling
- compact esp32 oled state response at /api/console/state?device=esp32

Primary services:

- backend/src/services/sceneEngine.js
- backend/src/services/console.js
- backend/src/services/esp32Input.js
- backend/src/api/websocket.js

## Key Flows

### Page Sync Flow

display websocket sync_page -> backend websocket handler -> console openPage -> page_change broadcast

### ESP32 Input Flow

esp32 mqtt publish -> mosquitto -> esp32Input service -> sceneEngine/consoleService -> state + websocket updates

### OLED State Flow

consoleService getEsp32State -> GET /api/console/state?device=esp32 -> esp32 poll -> oled render

### Standby Flow

- standby flag comes from backend settings/display state
- PIR motion can wake standby through esp32 event handling
- standby mode forces camera effective-off in privacy status output

## Security Notes

- secrets live in backend/.env and esp32 local config, not in repository defaults
- write routes are admin-session protected
- mqtt broker uses username/password from env
- sensitive settings are redacted in outward API responses where appropriate

## Document Metadata

- Version: 1.1
- Last Updated: March 18, 2026
