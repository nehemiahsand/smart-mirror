# Smart Mirror Design

## Overview

The current system is a Raspberry Pi 5 smart mirror with a split UI model:

- a dedicated mirror display app on port `3000`
- an admin/mobile PWA served by the backend on port `80`
- an ESP32 side console that both publishes inputs over MQTT and polls a compact backend state feed for its OLED

The backend is the source of truth for page state, standby state, privacy state, and ESP32 console state.

## Runtime Topology

### Containers

- `mosquitto`
  - authenticated MQTT broker for ESP32 events
- `sensor`
  - Python DHT22 sidecar exposed internally on `5555`
- `camera`
  - Python/Flask camera service exposed internally on `5556`
- `backend`
  - Node/Express API, WebSocket hub, auth/session layer, scene engine, console service, and built PWA
- `display`
  - React/Vite mirror display on `3000`
- `voice`
  - Python/Vosk voice controller connected to backend HTTP + WebSocket

### External Hardware

- DHT22 on Pi GPIO `4`
- USB camera
- USB microphone
- HDMI display
- ESP32 console with five buttons, PIR, and SSD1306 OLED

## Main Backend Responsibilities

The backend currently owns:

- session auth and admin-protected write routes
- settings persistence
- weather, traffic, sports, photos, Spotify, Google Calendar, Wi-Fi, power, and privacy APIs
- WebSocket broadcast of scene, page, sensor, weather, and console state
- scene/standby coordination
- ESP32 input ingestion over MQTT
- OLED state generation for `GET /api/console/state?device=esp32`

Important services:

- `sceneEngine`
  - decides standby and page-sync behavior
- `consoleService`
  - builds the OLED-facing state and handles button actions
- `esp32InputService`
  - subscribes to `smartmirror/esp32/+/event` and `.../status`
- `cameraService`
  - tracks `person_detected`, darkness, and camera enable state

## Current Frontend Model

### Mirror Display

The display app is a separate frontend on port `3000`. It is the visual mirror UI and currently syncs around two primary pages:

- `home`
- `spotify`

### Mobile/Admin PWA

The PWA is built into the backend image and served from the backend root path. It is not a separate compose service anymore.

It provides:

- dashboard and quick info
- standby toggle
- privacy controls
- page switching
- settings and admin flows
- power controls

## Current ESP32 Model

The ESP32 uses two transports:

- MQTT for button/PIR events
- HTTP polling for compact OLED state

Current button mapping:

- button 1: `GPIO32`
- button 2: `GPIO26`
- button 3: `GPIO27`
- button 4: `GPIO25`
- button 5: `GPIO23`

Current OLED states:

- `page`
- `standby`
- `stats`

Current stats lines:

- camera state and mic state
- CPU and RAM
- uptime and CPU temperature
- person detected yes/no

## Standby and Wake Flow

The current wake/standby policy is:

- PIR motion wakes the mirror from standby
- entering standby disables camera input and voice
- camera no-person and dark-room logic can send the mirror back into standby once awake
- camera alone does not act as the standby wake source

The PWA privacy status endpoint reports effective camera/voice state so standby appears as camera-off and mic-off.

## Data Flow Notes

### ESP32 Button Flow

`ESP32 button` -> `MQTT broker` -> `esp32InputService` -> `sceneEngine/consoleService` -> `WebSocket + console state API`

### OLED State Flow

`consoleService.getEsp32State()` -> `/api/console/state?device=esp32` -> `ESP32 poll` -> OLED render

### Voice Flow

`Vosk transcript` -> `voice_service.py` -> backend REST/WebSocket -> display page or Spotify action

### Camera Flow

`camera_service.py` -> `cameraService` -> `sceneEngine.applyStandbyMode(...)` -> display/privacy broadcasts

### Hardware Interfaces
- **DHT22 Sensor:** GPIO 4 (BCM numbering)
- **Camera:** USB (/dev/video0)
- **Microphone:** USB (PortAudio/ALSA)
- **Display:** HDMI (controlled via wlr-randr, DPMS, vcgencmd)

## Deployment Architecture

### Docker Compose
All services run in separate containers on the same Docker network with `network_mode: host` for hardware access.

**Container Privileges:**
- `sensor` - Privileged for GPIO access
- `camera` - Device access to /dev/video0
- `voice` - Device access to /dev/snd (audio)
- `backend` - Privileged for display control and NetworkManager D-Bus

**Volumes:**
- `backend/data` - Persistent storage for settings, photos, credentials
- All containers share timezone for consistent timestamps

### Network Topology
```
Internet
    │
    ├─── OpenWeather API (weather data)
    ├─── Google Maps API (traffic/directions)
    ├─── ESPN API (sports scores)
    ├─── Google Calendar API (events)
    ├─── Spotify Web API (playback control)
    └─── Google Speech API (voice recognition)
    
Tailscale VPN (optional)
    │
    └─── Remote access to mirror from anywhere

Raspberry Pi 5
    │
    ├─── Port 3000 - Display (React)
    ├─── Port 3001 - Backend API + WebSocket
    └─── Port 3002 - PWA (React)
```

## Security Considerations

1. **API Keys:** Stored in environment variables, not committed to git
2. **OAuth Tokens:** Stored in `settings.json`, backed up via volume mount
3. **Network Access:** Services only accessible on local network (except via Tailscale)
4. **WebSocket:** No authentication (assumed secure local network)
5. **Privileged Containers:** Required for hardware access, isolated via Docker

## Performance Characteristics

- **Startup Time:** ~30 seconds (all containers)
- **Memory Usage:** ~1.2GB total across all containers
- **CPU Usage:** <10% idle, ~20% during active voice recognition
- **Network Bandwidth:** <1 MB/min (periodic API calls)
- **Display Latency:** <100ms (WebSocket updates)
- **Voice Recognition Latency:** 1-3 seconds (Google API roundtrip)

## Scalability & Extensibility

**Easy to Add:**
- New widgets (drop in `display/src/widgets/`)
- New API integrations (add service in `backend/src/services/`)
- New voice commands (update `COMMANDS` dict in voice service)
- New sensors (follow sensor service pattern)

**Design Patterns Used:**
- Microservices architecture
- Service-oriented architecture (SOA)
- Publish-subscribe (WebSocket events)
- Repository pattern (settings service)
- Adapter pattern (external API services)
- Factory pattern (widget rendering)

---

**Document Version:** 1.0  
**Last Updated:** December 10, 2025  
**Architecture Reviewed By:** AI-Assisted Development Team
