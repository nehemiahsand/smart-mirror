# Smart Mirror

A modern, modular smart mirror built with React, Node.js, and Raspberry Pi 5.

## Features

- 🌤️ **Weather Display** - Real-time weather with OpenWeather API and sunrise/sunset times
- 📅 **Calendar Integration** - Google Calendar sync with OAuth authentication
- 📸 **Photo Slideshow** - Local photo management with drag-and-drop ordering and auto-save
- 🌡️ **DHT22 Sensor** - Temperature & humidity monitoring via dedicated Python service
- 📱 **Mobile PWA** - Control your mirror from anywhere with React-based web app
- 💤 **Standby Mode** - LCD backlight control via wlr-randr (Wayland)
- 🔌 **WiFi Provisioning** - Easy network setup via hotspot mode
- 🌐 **Remote Access** - Secure access via Tailscale VPN
- 🐳 **Docker-based** - All services containerized with Docker Compose
- 🔄 **Real-time Updates** - WebSocket-based live data synchronization

## Remote Access

This mirror uses **Tailscale VPN** for secure remote access from anywhere in the world.

### Access URLs:

**Via Tailscale (from anywhere):**
- PWA: `http://100.120.146.19:3002`
- Display: `http://100.120.146.19:3000`
- API: `http://100.120.146.19:3001`

**On Local Network:**
- PWA: `http://192.168.1.85:3002` or `http://nehemiah-pi5.local:3002`
- Display: `http://192.168.1.85:3000`
- API: `http://192.168.1.85:3001`

**Via Setup Hotspot:**
- PWA: `http://10.42.0.1:3002`
- Display: `http://10.42.0.1:3000`
- API: `http://10.42.0.1:3001`

## Quick Start

### First Time Setup

1. **Install Tailscale** (for remote access):
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```

2. **Configure API Keys**:
   ```bash
   cd backend
   cp .env.example .env
   nano .env  # Add your OpenWeather API key
   ```

3. **Start the Mirror**:
   ```bash
   ./start-mirror.sh
   ```

### WiFi Setup

If the mirror can't connect to a known network, it automatically:
1. Creates an open hotspot: **SmartMirror-Setup**
2. Starts all services on `10.42.0.1`
3. Connect your phone to the hotspot
4. Open PWA at `http://10.42.0.1:3002`
5. Scan and connect to your WiFi
6. Mirror automatically reboots on the new network

## Services

- **Backend** (Port 3001): Node.js Express API + WebSocket server + Display power control
- **Display** (Port 3000): React + Vite main mirror UI with 4 active widgets
- **PWA** (Port 3002): React + Vite mobile web app for remote control
- **Sensor** (Port 5555): Python Flask server for DHT22 temperature/humidity sensor

## Technology Stack

### Hardware
- **Raspberry Pi 5** (4GB+ recommended)
- **DHT22 Sensor** - GPIO 4 for temperature/humidity
- **LCD Monitor** - HDMI display with backlight control support

### Software
- **OS**: Raspberry Pi OS Bookworm (Wayland compositor)
- **Runtime**: Docker & Docker Compose
- **Frontend**: React 18 + Vite
- **Backend**: Node.js 18 + Express + Socket.IO
- **Sensor**: Python 3.11 + Flask + Adafruit DHT library
- **Network**: NetworkManager + Tailscale VPN
- **Display Control**: wlr-randr (Wayland), DPMS fallback
- **Calendar**: Google Calendar API v3 with OAuth 2.0
- **Weather**: OpenWeather API
- **Photos**: Local filesystem storage

## Auto-Start on Boot

The mirror starts automatically via systemd service `smart-mirror.service`.

Edit the service:
```bash
sudo systemctl edit smart-mirror.service
```

Check status:
```bash
sudo systemctl status smart-mirror.service
```

## Documentation

- [Setup Instructions](SETUP_INSTRUCTIONS.md)
- [Docker Guide](DOCKER.md)
- [Fullscreen Setup](FULLSCREEN_GUIDE.txt)
- [Mobile App](mobile-app/README.md)

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│          Raspberry Pi 5 Smart Mirror                     │
├──────────────────────────────────────────────────────────┤
│  Display Layer (React + Vite)                            │
│  ├─ Mirror UI (Port 3000) - 4 Widgets                    │
│  │  ├─ TimeDate (system time, offline)                   │
│  │  ├─ WeatherTemp (OpenWeather + sunrise/sunset)        │
│  │  ├─ GoogleCalendar (OAuth 2.0)                        │
│  │  └─ Photos (Google Photos API)                        │
│  └─ Mobile PWA (Port 3002)                               │
│     ├─ Dashboard (standby, refresh, sensor)              │
│     ├─ WiFi Setup (scan, connect)                        │
│     ├─ Photo Manager (drag-drop, auto-save)              │
│     ├─ Widget Manager (enable/disable)                   │
│     └─ Settings (quick actions)                          │
├──────────────────────────────────────────────────────────┤
│  Backend Layer (Node.js 18 + Express)                    │
│  ├─ REST API (Port 3001)                                 │
│  │  ├─ /api/settings - Persistent JSON storage           │
│  │  ├─ /api/weather - OpenWeather integration            │
│  │  ├─ /api/calendar - Google Calendar OAuth             │
│  │  ├─ /api/photos - Local photo file management         │
│  │  ├─ /api/wifi - NetworkManager control                │
│  │  ├─ /api/sensor - DHT22 proxy                         │
│  │  ├─ /api/display/power - wlr-randr control            │
│  │  └─ /api/power - System reboot                        │
│  ├─ WebSocket Server (Socket.IO)                         │
│  │  ├─ Real-time sensor updates                          │
│  │  ├─ Weather push notifications                        │
│  │  └─ Settings synchronization                          │
│  └─ Services                                             │
│     ├─ Display Service (wlr-randr, vcgencmd, DPMS)       │
│     ├─ Weather Service (OpenWeather cache)               │
│     ├─ Calendar Service (Google OAuth tokens)            │
│     ├─ Photos Service (local filesystem + metadata)      │
│     ├─ WiFi Service (NetworkManager D-Bus)               │
│     └─ Settings Service (JSON persistence)               │
├──────────────────────────────────────────────────────────┤
│  Sensor Layer (Python 3.11 + Flask)                      │
│  └─ DHT22 Service (Port 5555)                            │
│     ├─ Adafruit DHT library                              │
│     ├─ GPIO 4 reading                                    │
│     └─ REST endpoint: /sensor/read                       │
├──────────────────────────────────────────────────────────┤
│  System Layer                                            │
│  ├─ Wayland Compositor (display server)                  │
│  ├─ wlr-randr (display power control)                    │
│  ├─ NetworkManager (WiFi management)                     │
│  ├─ Tailscale VPN (remote access)                        │
│  ├─ Docker Compose (orchestration)                       │
│  └─ systemd (smart-mirror.service autostart)             │
└──────────────────────────────────────────────────────────┘
```

### Active Widgets
1. **TimeDate**: System clock and date (no API required, offline-capable)
2. **WeatherTemp**: Current weather, temperature, sunrise/sunset from OpenWeather
3. **GoogleCalendar**: Upcoming events from Google Calendar via OAuth
4. **Photos**: Local photo slideshow with drag-drop ordering and metadata

## Tailscale Configuration

Tailscale runs automatically on boot and provides:
- Secure remote access from anywhere
- No port forwarding needed
- End-to-end encryption
- Easy device discovery

**Your Tailscale IP:** `100.120.146.19`

Access the PWA from your phone (with Tailscale app installed) using this IP from anywhere!

## License

MIT
