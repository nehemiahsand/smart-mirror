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

## Local Development & CI/CD Pipeline

The project is structured to support true "Local Development" on non-Raspberry Pi hardware alongside a complete Git-Ops workflow:
1. **Hardware Abstraction:** Backend services gracefully mock hardware-dependent behavior when running under `NODE_ENV=development`, which prevents fatal crashes when coding on a personal computer (Mac/PC).
2. **Continuous Integration (CI):** A GitHub Actions workflow (`.github/workflows/ci.yml`) automatically performs Node.js dependency audits and Jest unit tests (`backend/__tests__`) upon every push to the `main` branch.
3. **Continuous Deployment (CD):** The Raspberry Pi utilizes a systemd `.timer` (`deploy/systemd/smart-mirror-updater.timer`) to poll the remote repository for changes. If a new passing version lands in `main`, the mirror automatically triggers `git pull` and `docker compose up -d --build`.

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
- home page: button2 previous sport, button3 next sport, button4 default sport
- fun page: button2 previous date, button3 next date, button4 home
- spotify page: button2 previous track, button3 next track, button4 play/stop
- button5 toggles stats overlay
- stats mode: button2 previous stats page, button3 next stats page, button5 back
- standby: button1 wakes display, button5 opens stats
- manual pages such as fun and spotify return to home after 5 minutes of inactivity by default

Stats presentation:

- compact 128x32 OLED uses one stats subpage at a time rather than four cramped rows
- current stats pages are disk/ping, cpu/ram, uptime/temp, and motion state
- stats navigation is handled locally on the ESP32 so page changes feel immediate

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

- backend console state is authoritative for page selection
- websocket connection sends current console_state to the display on connect/reconnect
- manual page changes update consoleService first, then broadcast page_change
- inactivity timeout returns manual pages to home and broadcasts that change to both display and OLED clients

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

- Version: 1.3
- Last Updated: March 23, 2026
