# Smart Mirror Design

## Overview

Current system shape:

- display frontend on port 3000 (React/Vite bundle served from a lightweight container)
- backend on port 80 (Express API + WebSocket + PWA static hosting)
- ESP32 OLED/button console using MQTT events and HTTP state polling

The backend is the source of truth for page state, standby state, console soft buttons, and scene state.

## Runtime Topology

### Containers

- mosquitto
  - authenticated MQTT broker for ESP32 topics
- camera
  - camera stream/control sidecar on internal port 5556
- backend
  - API, auth/session, scene engine, console service, WebSocket hub, and served PWA bundle
- display
  - mirror UI on port 3000

### Hardware

- Raspberry Pi 5
- USB camera
- USB microphone
- HDMI display
- ESP32 with five buttons, DHT22 input, and SSD1306 OLED

## Local Development & CI/CD Pipeline

The project is structured to support true "Local Development" on non-Raspberry Pi hardware alongside a complete Git-Ops workflow:
1. **Hardware Abstraction:** Backend services gracefully mock hardware-dependent behavior when running under `NODE_ENV=development`, which prevents fatal crashes when coding on a personal computer (Mac/PC).
2. **Continuous Integration (CI):** A GitHub Actions workflow (`.github/workflows/ci.yml`) automatically performs Node.js dependency audits and Jest unit tests (`backend/__tests__`) upon every push to the `main` branch.
3. **Continuous Deployment (CD):** The Raspberry Pi utilizes a systemd `.timer` (`deploy/systemd/smart-mirror-updater.timer`) to poll the remote repository for changes. The updater performs a fast-forward-only pull and rebuilds with `docker compose up -d --build` only when the local checkout is behind `origin/main`; if the local branch is ahead of or diverged from `origin/main`, it skips deployment.

## Active UX Surfaces

### Mirror Display

Current synchronized pages:

- home
- fun
- spotify

Home page renders enabled widgets (time/date, weather+traffic, calendar, sports, photos).
Standby mode renders a minimal standby screen.
The display container serves the production bundle at runtime rather than a Vite HMR/dev session.

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

- button1 short press toggles page cycle home -> fun -> spotify -> home
- button1 hold enters standby while awake
- home page: button2 previous sport, button3 next sport, button4 default sport
- fun page: button2 previous highlight, button3 next highlight, button4 video/box toggle
- spotify page: button2 previous track, button3 next track, button4 play/stop
- button5 toggles stats overlay
- stats mode: button2 previous stats page, button3 next stats page, button5 back
- standby: button1 wakes display, button5 opens stats
- manual pages such as fun and spotify return to home after 5 minutes of inactivity by default

Stats presentation:

- compact 128x32 OLED uses one stats subpage at a time rather than four cramped rows
- current stats pages are disk/ping, cpu/ram, and uptime/temp
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
- standby is entered manually from the dashboard or a held button1 press from the ESP32
- standby wake is handled by button1 from the ESP32 or by dashboard actions
- standby turns the display off but does not disable the camera service or PWA camera stream
- the Camera page uses short-lived stream tokens and periodic reconnects so long-lived MJPEG sessions recover without a full page reload

## Security Notes

- secrets live in backend/.env and esp32 local config, not in repository defaults
- write routes are admin-session protected
- mqtt broker uses username/password from env
- sensitive settings are redacted in outward API responses where appropriate

## Document Metadata

- Version: 1.4
- Last Updated: April 18, 2026
