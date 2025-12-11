# Smart Mirror - Technical Design Document

## Architecture Overview

The Smart Mirror is a distributed, containerized system built on Raspberry Pi 5, consisting of 6 microservices that communicate via REST APIs and WebSockets.

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RASPBERRY PI 5 HARDWARE                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   DHT22      │  │  USB Camera  │  │ USB Mic      │  │ HDMI Display │   │
│  │   Sensor     │  │              │  │              │  │              │   │
│  │  (GPIO 4)    │  │              │  │              │  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────▲───────┘   │
│         │                 │                 │                 │            │
└─────────┼─────────────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │                 │
          │                 │                 │                 │
┌─────────▼─────────────────▼─────────────────▼─────────────────┼────────────┐
│                        DOCKER CONTAINERS                       │            │
│                                                                │            │
│  ┌──────────────────────────────────────────────────────────┐ │            │
│  │               SENSOR SERVICE (Port 5555)                  │ │            │
│  │  - Python Flask server                                    │ │            │
│  │  - Reads DHT22 temperature/humidity via GPIO              │ │            │
│  │  - Exposes /sensor endpoint                               │ │            │
│  └────────────────────────┬─────────────────────────────────┘ │            │
│                           │ HTTP                               │            │
│  ┌────────────────────────▼─────────────────────────────────┐ │            │
│  │               CAMERA SERVICE                              │ │            │
│  │  - Python OpenCV service                                  │ │            │
│  │  - Person detection using Haar Cascade AI model           │ │            │
│  │  - Auto-triggers standby mode when no person detected     │ │            │
│  │  - Sends standby commands to backend                      │ │            │
│  └────────────────────────┬─────────────────────────────────┘ │            │
│                           │ HTTP                               │            │
│  ┌────────────────────────▼─────────────────────────────────┐ │            │
│  │               VOICE SERVICE                               │ │            │
│  │  - Python SpeechRecognition (Google API)                  │ │            │
│  │  - Continuous listening (no wake word)                    │ │            │
│  │  - Page-aware command processing                          │ │            │
│  │  - WebSocket client for page sync                         │ │            │
│  └────────────────────────┬─────────────────────────────────┘ │            │
│                           │ WebSocket + HTTP                   │            │
│                           │                                    │            │
│  ┌────────────────────────▼─────────────────────────────────┐ │            │
│  │            BACKEND API (Port 3001)                        │ │            │
│  │  ┌──────────────────────────────────────────────────┐    │ │            │
│  │  │  Express.js REST API Server                      │    │ │            │
│  │  │  - /api/weather (OpenWeather API)                │    │ │            │
│  │  │  - /api/traffic/commute (Google Maps API)        │    │ │            │
│  │  │  - /api/sports/:sport/scores (ESPN API)          │    │ │            │
│  │  │  - /api/calendar/events (Google Calendar OAuth)  │    │ │            │
│  │  │  - /api/photos (File management)                 │    │ │            │
│  │  │  - /api/spotify/* (Spotify Web API OAuth)        │    │ │            │
│  │  │  - /api/sensor (Proxy to sensor service)         │    │ │            │
│  │  │  - /api/settings (JSON file persistence)         │    │ │            │
│  │  │  - /api/wifi/* (NetworkManager D-Bus)            │    │ │            │
│  │  └──────────────────────────────────────────────────┘    │ │            │
│  │  ┌──────────────────────────────────────────────────┐    │ │            │
│  │  │  Socket.IO WebSocket Server                      │    │ │            │
│  │  │  - Real-time data broadcast                      │    │ │            │
│  │  │  - Page change events                            │    │ │            │
│  │  │  - Standby mode events                           │    │ │            │
│  │  │  - Settings update events                        │    │ │            │
│  │  └──────────────────────────────────────────────────┘    │ │            │
│  └────────┬──────────────────────┬────────────────────────┘ │            │
│           │ WebSocket            │ HTTP                      │            │
│           │                      │                           │            │
│  ┌────────▼──────────┐  ┌────────▼──────────────────────┐   │            │
│  │  DISPLAY          │  │  PWA                          │   │            │
│  │  (Port 3000)      │  │  (Port 3002)                  │   │            │
│  │  ┌─────────────┐  │  │  ┌─────────────────────────┐  │   │            │
│  │  │ React App   │  │  │  │ React Progressive Web   │  │   │            │
│  │  │ - TimeDate  │  │  │  │ - Dashboard (Quick Info)│  │   │            │
│  │  │ - Weather   │  │  │  │ - Widget Manager        │  │   │            │
│  │  │ - Traffic   │  │  │  │ - Photo Upload          │  │   │            │
│  │  │ - Calendar  │  │  │  │ - Sports Config         │  │   │            │
│  │  │ - Sports    │  │  │  │ - Settings Editor       │  │   │            │
│  │  │ - Photos    │  │  │  │ - WiFi Setup            │  │   │            │
│  │  │ - Spotify   │  │  │  │ - System Controls       │  │   │            │
│  │  └─────────────┘  │  │  └─────────────────────────┘  │   │            │
│  └────────┬──────────┘  └────────────────────────────────┘   │            │
│           │                                                   │            │
└───────────┼───────────────────────────────────────────────────┘            │
            │                                                                │
            └────────────────────────────────────────────────────────────────┘
                                    HDMI Output
```

## Component Details

### 1. Sensor Service (Python/Flask)
**Technology:** Python 3.11, Flask, Adafruit DHT library  
**Purpose:** Hardware interface for DHT22 temperature/humidity sensor  
**AI Assistance:** 75% - Service structure, GPIO handling, error recovery  
**Key Features:**
- Reads GPIO pin 4 for DHT22 data
- Auto-retry on sensor read failures
- Caches last valid reading for 5 seconds
- REST endpoint: GET `/sensor` → `{temperature, humidity, fahrenheit}`

### 2. Camera Service (Python/OpenCV)
**Technology:** Python 3.11, OpenCV, Haar Cascade Classifier  
**Purpose:** Person detection for automatic standby mode  
**AI Assistance:** 80% - OpenCV integration, cascade model usage, HTTP requests  
**Key Features:**
- Uses pre-trained Haar Cascade AI model for face detection
- Captures frame every 2 seconds
- Triggers standby if no person detected for 30 minutes
- Auto-wakes display when person appears
- Sends commands to backend: POST `/api/settings`

### 3. Voice Service (Python/SpeechRecognition)
**Technology:** Python 3.11, SpeechRecognition, Google Speech API, WebSocket  
**Purpose:** Continuous voice command recognition  
**AI Assistance:** 85% - Command parsing logic, WebSocket sync, keyword expansion  
**Key Features:**
- No wake word required (always listening)
- Page-aware command processing (different commands per page)
- WebSocket connection for real-time page state sync
- Phonetic variations for improved recognition
- Commands: navigation (Spotify/Home), playback (play/pause/next/previous)

### 4. Backend Service (Node.js/Express)
**Technology:** Node.js 18, Express, Socket.IO, Axios  
**Purpose:** Central API hub and data aggregation  
**AI Assistance:** 70% - Route structure, service integrations, WebSocket broadcasts  
**Key Features:**
- **Weather Service:** OpenWeather API with 10-min cache
- **Traffic Service:** Google Maps Directions API with live ETA
- **Sports Service:** ESPN API with current-day game prioritization
- **Calendar Service:** Google Calendar OAuth 2.0 with token refresh
- **Photos Service:** Local file management with drag-drop ordering
- **Spotify Service:** Spotify Web API OAuth with playback control
- **Settings Service:** JSON file persistence
- **WiFi Service:** NetworkManager D-Bus integration
- **Display Control:** LCD backlight via wlr-randr/vcgencmd
- **WebSocket Hub:** Real-time broadcasts to all clients

### 5. Display Service (React/Vite)
**Technology:** React 18, Vite, Socket.IO Client, date-fns  
**Purpose:** Main mirror interface  
**AI Assistance:** 65% - Component structure, styling, WebSocket hooks  
**Key Features:**
- Fullscreen dark glass aesthetic
- Real-time widget updates via WebSocket
- Standby mode (black screen overlay)
- Widget positioning system
- Widgets: TimeDate, WeatherTraffic, GoogleCalendar, SportsScores, Photos, SpotifyPlayer
- Page navigation (Home ↔ Spotify)

### 6. PWA Service (React/Vite)
**Technology:** React 18, Vite, Workbox, React Router  
**Purpose:** Mobile control interface  
**AI Assistance:** 60% - UI components, routing, API integration  
**Key Features:**
- Progressive Web App (installable)
- Quick Info dashboard (indoor temp/humidity, outdoor temp, traffic)
- Widget management (reorder, enable/disable)
- Photo upload and organization
- Sports team selection
- Settings editor
- WiFi configuration
- System controls (reboot, shutdown, standby)

## Data Flow Examples

### Example 1: Voice Command Flow
```
User says "play" → USB Mic → Voice Service
                              ↓
                    Google Speech API (AI model)
                              ↓
                    Recognized text: "play"
                              ↓
                    Check current page via WebSocket
                              ↓
                    Page = "spotify" → Match command
                              ↓
                    PUT /api/spotify/play → Backend
                              ↓
                    Spotify Web API → Start playback
                              ↓
                    WebSocket broadcast → Display refreshes
```

### Example 2: Person Detection Flow
```
Camera captures frame → Camera Service
                              ↓
                    Haar Cascade AI model
                              ↓
                    Person detected? NO
                              ↓
                    Wait 30 minutes → Still no person?
                              ↓
                    POST /api/settings {standbyMode: true}
                              ↓
                    Backend → Display power off (vcgencmd)
                              ↓
                    WebSocket broadcast → Display shows overlay
```

### Example 3: Real-time Sports Score Update
```
Display renders SportsScores widget → GET /api/sports/nba/scores
                                              ↓
                                    Backend checks cache (2 min TTL)
                                              ↓
                                    Cache miss → ESPN API
                                              ↓
                                    Fetch today's games (including live)
                                              ↓
                                    Format data → Return JSON
                                              ↓
                                    Display updates score every 2 min
```

### Example 4: Traffic ETA Calculation
```
WeatherTraffic widget mounts → GET /api/traffic/commute
                                              ↓
                                    Backend Google Maps API
                                              ↓
                                    {durationMinutes: 15, distance: "8.9 mi"}
                                              ↓
                                    Widget calculates: currentTime + 15 min
                                              ↓
                                    Display: "ETA 2:47 PM" (updates every 1 sec)
                                              ↓
                                    Re-fetch drive time every 5 min
```

## Communication Protocols

### REST API
- **Format:** JSON
- **Authentication:** 
  - Google Calendar: OAuth 2.0 with refresh tokens
  - Spotify: OAuth 2.0 with refresh tokens
  - Weather/Maps/Sports: API keys
- **Caching:** 
  - Weather: 10 minutes
  - Sports: 2 minutes
  - Traffic: 5 minutes
  - Sensor: 5 seconds

### WebSocket (Socket.IO)
- **Port:** 3001 (same as backend)
- **Events:**
  - `page_change` - Page navigation (home/spotify)
  - `standby_change` - Display standby state
  - `settings_update` - Settings changed
  - `display_refresh` - Force widget refresh
  - `sensor_update` - Real-time sensor data
  - `connection` - Client connected
  - `disconnect` - Client disconnected

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
