# Smart Mirror

A modern, full-featured smart mirror built with React, Node.js, and Raspberry Pi 5. Features real-time weather, sports scores, traffic updates, Google Calendar integration, voice control, and more.

---

## 🎯 Features

### Display & Widgets
- 🕐 **Time & Date** - Real-time clock with customizable format
- 🌤️ **Weather & Temperature** - Indoor (DHT22 sensor) and outdoor (OpenWeather API) with traffic
- 📅 **Google Calendar** - OAuth-authenticated calendar sync with event display
- 🏀 **Sports Scores** - Live scores from ESPN for NBA, NFL, NCAA Football/Basketball, MLB, and Soccer
- 📸 **Photos Slideshow** - Local photo management with drag-and-drop ordering
- 🚗 **Traffic Widget** - Real-time ETA calculation with live-updating arrival time

### Control & Interaction
- 🎤 **Voice Commands** - Hands-free control via continuous voice recognition
  - Navigate between pages (Home, Spotify)
  - Control Spotify playback (Play, Pause, Next, Previous)
  - Volume control
- 📱 **Mobile PWA** - Full-featured Progressive Web App for remote control
  - Widget management and ordering
  - Settings configuration
  - Photo upload and management
  - Sports team selection
  - System controls (reboot, shutdown, standby)

### Smart Features
- 💤 **Standby Mode** - LCD backlight control with auto-standby after 30 minutes
- 👁️ **Person Detection** - AI-powered camera service with automatic wake/sleep
- 🌐 **WebSocket Sync** - Real-time data updates across all connected clients
- 🔄 **Page Synchronization** - Voice service always knows the current display page
- 🌡️ **DHT22 Sensor** - Dedicated Python service for temperature/humidity monitoring

### Infrastructure
- 🐳 **Docker-based** - All services containerized with Docker Compose
- 🔌 **WiFi Provisioning** - Easy network setup via hotspot mode
- 🌐 **Remote Access** - Secure access via Tailscale VPN
- 🎨 **Drag-and-Drop Layout** - Visual widget arrangement (future feature)

---

## 📋 System Requirements

### Hardware
- **Raspberry Pi 5** (4GB+ RAM recommended)
- **DHT22 Temperature/Humidity Sensor** (optional)
- **USB Microphone** (for voice commands)
- **USB Camera** (for person detection, optional)
- **Display** (HDMI monitor or touch screen)

### Software
- **Raspberry Pi OS** (64-bit, Bookworm or later)
- **Docker & Docker Compose** (v2.0+)
- **Tailscale** (for remote access, optional)

---

## 🚀 Quick Start

### 1. Initial Setup

**Clone the repository:**
```bash
cd ~/Downloads
git clone <repository-url> smart-mirror
cd smart-mirror
```

**Install Docker (if not already installed):**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

**Install Tailscale for remote access (optional but recommended):**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### 2. Configure API Keys

**Set your API keys:**
```bash
./set-api-key.sh
```

You'll need:
- **OpenWeather API Key** - Get from https://openweathermap.org/api
- **Google Maps API Key** - Get from https://console.cloud.google.com
  - Enable: Directions API, Distance Matrix API, Geocoding API

**Configure traffic addresses:**
Edit `backend/data/settings.json`:
```json
{
  "traffic": {
    "enabled": true,
    "origin": "Your Home Address",
    "destination": "Your Work/School Address",
    "googleMapsApiKey": "YOUR_API_KEY"
  }
}
```

### 3. Google Calendar Setup (Optional)

**Download credentials:**
1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Desktop App)
5. Download credentials JSON file
6. Save as `backend/data/calendar-credentials.json`

**Authorize the calendar:**
```bash
cd backend
node authorize-calendar.js
```

Follow the URL, authorize, and paste the code back.

### 4. Spotify Setup (Optional)

**Create Spotify Developer App:**
1. Go to https://developer.spotify.com/dashboard
2. Log in and click "Create an App"
3. Fill in app name: "Smart Mirror"
4. Add redirect URI: `http://<your-pi-ip>:3001/api/spotify/callback`
5. Copy your Client ID and Client Secret

**Configure Spotify credentials:**
```bash
cd backend
nano .env
```

Add these lines:
```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://<your-pi-ip>:3001/api/spotify/callback
```

**Authenticate:**
1. Restart backend: `docker compose restart backend`
2. Open display at `http://<pi-ip>:3000`
3. Navigate to Spotify page (say "Spotify" or use PWA)
4. Click "Connect Spotify" and authorize

### 5. Start the System

**Build and start all services:**
```bash
docker compose up -d --build
```

**Check all containers are running:**
```bash
docker compose ps
```

You should see 6 containers:
- `smart-mirror-backend` - API server (port 3001)
- `smart-mirror-display` - React display (port 3000)
- `smart-mirror-pwa` - Mobile app (port 3002)
- `smart-mirror-voice` - Voice recognition
- `smart-mirror-sensor` - DHT22 sensor service
- `smart-mirror-camera` - Person detection

### 5. Access the Mirror

**Display (main interface):**
- Local: `http://localhost:3000`
- Network: `http://<raspberry-pi-ip>:3000`
- Tailscale: `http://<tailscale-ip>:3000`

**PWA (mobile control):**
- Local: `http://localhost:3002`
- Network: `http://<raspberry-pi-ip>:3002`
- Tailscale: `http://<tailscale-ip>:3002`

**API (backend):**
- Local: `http://localhost:3001`

---

## 🎙️ Voice Commands

The voice service runs continuously and listens for commands. No wake word needed!

### Navigation Commands
- **"Spotify"** / "Music" / "Player" → Go to Spotify page
- **"Home"** / "Main" / "Back" / "Exit" → Return to home page

### Playback Controls (on Spotify page)
- **"Play"** / "Resume" / "Start" → Play music
- **"Pause"** / "Stop" → Pause music
- **"Next"** / "Skip" → Next track
- **"Previous"** / "Back" → Previous track
- **"Volume up"** / "Louder" → Increase volume
- **"Volume down"** / "Quieter" → Decrease volume

### How It Works
- Voice service connects via WebSocket to stay synced with display
- Automatically detects which page you're on
- Commands only work on the appropriate page
- When exiting standby, automatically re-syncs to correct page

---

## 📱 Mobile PWA Features

Access the PWA at `http://<pi-ip>:3002` from any device on your network.

### Dashboard
- **Quick Info** - Indoor temp/humidity, outdoor temp, traffic
- **Quick Actions** - Standby toggle, page navigation
- **Power Controls** - Reboot, shutdown

### Widget Manager
- Reorder widgets via drag-and-drop
- Save custom layout

### Photos
- Upload photos via web interface
- Drag to reorder slideshow
- Delete unwanted photos
- Auto-saves order

### Sports Settings
- Select favorite teams
- Choose which sport to display
- Supports: NBA, NFL, NCAA Football, NCAA Basketball, MLB, Soccer

### System Settings
- Weather location configuration
- Display preferences
- Network settings

---

## 🏗️ Architecture

### Services Overview

| Service | Purpose | Port | Technology |
|---------|---------|------|------------|
| **Backend** | API server, WebSocket hub, settings manager | 3001 | Node.js, Express |
| **Display** | Main mirror interface | 3000 | React, Vite |
| **PWA** | Mobile control app | 3002 | React, Vite |
| **Voice** | Voice recognition | - | Python, SpeechRecognition |
| **Sensor** | DHT22 temperature/humidity | - | Python, Adafruit |
| **Camera** | Person detection, auto-standby | - | Python, OpenCV |

### Data Flow
```
┌─────────────┐
│   Display   │ ←─── WebSocket ───→ ┌──────────┐
│  (Port 3000)│                      │ Backend  │
└─────────────┘                      │(Port 3001)│
                                     └──────────┘
┌─────────────┐                           ↑
│     PWA     │ ←─── HTTP/WebSocket ──────┤
│  (Port 3002)│                           │
└─────────────┘                           │
                                          │
┌─────────────┐                           │
│    Voice    │ ←─── WebSocket ───────────┤
│   Service   │                           │
└─────────────┘                           │
                                          │
┌─────────────┐      ┌─────────────┐     │
│   Sensor    │ ──→  │   Camera    │ ──→ │
│  (DHT22)    │      │ (Detection) │     │
└─────────────┘      └─────────────┘     │
                                          ↓
                                    ┌──────────┐
                                    │ External │
                                    │   APIs   │
                                    └──────────┘
                                    • OpenWeather
                                    • Google Maps
                                    • Google Calendar
                                    • ESPN Sports
                                    • Spotify
```

### Widget System

Widgets are modular React components that display on the main mirror:

**Available Widgets:**
- `TimeDate.jsx` - Clock and date display
- `WeatherTraffic.jsx` - Combined weather, indoor temp, and traffic
- `GoogleCalendar.jsx` - Calendar events
- `SportsScores.jsx` - Live sports scores with tabs
- `Photos.jsx` - Photo slideshow
- `SpotifyPlayer.jsx` - Spotify controls (separate page)

**Widget Order:**
Configured in `settings.json` → `widgetOrder` array. Change via PWA or directly in settings file.

---

## 🔧 Configuration

### Settings File: `backend/data/settings.json`

```json
{
  "display": {
    "brightness": 100,
    "orientation": "landscape",
    "clockFormat": "12h",
    "standbyMode": false
  },
  "weather": {
    "city": "Birmingham,US",
    "units": "imperial",
    "updateInterval": 600000
  },
  "traffic": {
    "enabled": true,
    "origin": "2301 Brookline Drive, Hoover, AL 35226",
    "destination": "1201 University Blvd, Birmingham, AL 35233",
    "googleMapsApiKey": "YOUR_API_KEY"
  },
  "widgetOrder": [
    "timedate",
    "weathertemp",
    "googlecalendar",
    "photos"
  ],
  "sports": {
    "sport": "nba",
    "teams": []
  }
}
```

### Environment Variables

**Backend** (`.env` or `set-api-key.sh`):
- `OPENWEATHER_API_KEY` - Weather data
- `GOOGLE_MAPS_API_KEY` - Traffic and directions

**Sensor Service:**
- `DHT22_PIN=4` - GPIO pin for DHT22 sensor

---

## 🎨 Customization

### Change Widget Layout

**Via PWA:**
1. Go to Widgets tab
2. Use ↑↓ buttons to reorder
3. Click "Save Changes"

**Manually:**
Edit `backend/data/settings.json` → `widgetOrder`

### Add Photos

**Via PWA:**
1. Go to Photos tab
2. Click "Upload Photos"
3. Select images
4. Drag to reorder
5. Changes save automatically

**Manually:**
```bash
cp your-photo.jpg backend/data/photos/
```

### Customize Sports

**Via PWA:**
1. Go to More → Sports
2. Select sport (NBA, NFL, etc.)
3. Optionally filter by favorite teams
4. Save

### Change Theme

Modify `display/src/App.css` for dark/light theme customization.

---

## 🐛 Troubleshooting

### Voice Commands Not Working

**Check voice service logs:**
```bash
docker logs smart-mirror-voice -f
```

**Common issues:**
- Microphone not detected → Check USB connection
- Commands not recognized → Speak clearly, avoid background noise
- Page sync issues → WebSocket might be disconnected, restart voice service

**Restart voice service:**
```bash
docker compose restart voice
```

### Widgets Not Displaying

**Check display logs:**
```bash
docker logs smart-mirror-display -f
```

**Verify backend is running:**
```bash
curl http://localhost:3001/api/health
```

**Restart display:**
```bash
docker compose restart display
```

### Sports Not Showing Games

**Check if there are games today:**
```bash
curl http://localhost:3001/api/sports/nba/scores | python3 -m json.tool
```

**Sports service automatically:**
- Shows today's games (scheduled, live, or completed)
- If no games today, searches up to 7 days ahead
- Updates every 2 minutes

### Traffic Not Updating

**Verify API key is set:**
```bash
docker logs smart-mirror-backend 2>&1 | grep -i "traffic\|google"
```

**Check traffic endpoint:**
```bash
curl http://localhost:3001/api/traffic/commute | python3 -m json.tool
```

**The traffic widget:**
- Fetches drive time every 5 minutes
- Calculates live ETA by adding drive time to current time
- Updates ETA display every second in real-time

### Camera/Sensor Not Working

**DHT22 Sensor:**
```bash
docker logs smart-mirror-sensor -f
```

**Camera Service:**
```bash
docker logs smart-mirror-camera -f
```

**Check hardware connections:**
- DHT22 → GPIO4 (by default)
- Camera → USB port

---

## 🔄 Maintenance

### Update the System

```bash
cd ~/Downloads/smart-mirror
git pull
docker compose down
docker compose up -d --build
```

### View All Logs

```bash
docker compose logs -f
```

### Restart All Services

```bash
docker compose restart
```

### Stop Everything

```bash
docker compose down
```

### Clear Cache/Data

**Sports cache:**
```bash
curl -X POST http://localhost:3001/api/sports/clear-cache
```

**Complete reset:**
```bash
docker compose down -v
docker compose up -d --build
```

---

## 🚀 Auto-Start on Boot

To make the mirror start automatically when the Raspberry Pi boots:

### Install Auto-Start Script

```bash
cd ~/Downloads/smart-mirror
./install-autostart.sh
```

This creates a desktop autostart entry that launches `start-mirror.sh` on boot.

### Configure Auto-Login (Optional)

For a completely hands-free experience:

```bash
sudo raspi-config
```

Navigate to:
- **System Options** → **Boot / Auto Login** → **Desktop Autologin**

The mirror will now start automatically on boot without any interaction!

---

## 📊 API Documentation

### Core Endpoints

**Health Check:**
```bash
GET /api/health
```

**Settings:**
```bash
GET /api/settings
POST /api/settings
PUT /api/settings
```

**Weather:**
```bash
GET /api/weather
```

**Traffic:**
```bash
GET /api/traffic/commute
```

**Sports:**
```bash
GET /api/sports                    # List supported sports
GET /api/sports/:sport/scores      # Get scores (nba, nfl, ncaaf, ncaab, mlb, soccer)
POST /api/sports/clear-cache       # Clear cache
```

**Calendar:**
```bash
GET /api/calendar/events
```

**Photos:**
```bash
GET /api/photos
POST /api/photos/upload
PUT /api/photos/order
DELETE /api/photos/:filename
```

**Sensor:**
```bash
GET /api/sensor
```

**WebSocket:**
```javascript
ws://localhost:3001

// Message types:
{ type: 'page_change', page: 'home' | 'spotify' }
{ type: 'standby_change', standby: true | false }
{ type: 'settings_update', settings: {...} }
{ type: 'display_refresh' }
```

---

## 🏆 Project Structure

```
smart-mirror/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── api/            # API routes and WebSocket
│   │   ├── services/       # Business logic (weather, sports, etc.)
│   │   ├── sensors/        # DHT22 integration
│   │   └── utils/          # Helpers and logger
│   ├── data/               # Settings, photos, credentials
│   └── Dockerfile
├── display/                 # React display interface
│   ├── src/
│   │   ├── widgets/        # Widget components
│   │   ├── components/     # UI components
│   │   └── hooks/          # Custom React hooks
│   └── Dockerfile
├── mobile-pwa/             # React mobile PWA
│   ├── src/
│   │   ├── pages/          # PWA pages
│   │   └── components/     # Shared components
│   └── Dockerfile
├── voice/                   # Python voice recognition
│   ├── voice_service.py
│   ├── requirements.txt
│   └── Dockerfile
├── sensor/                  # DHT22 sensor service
│   ├── dht22_server.py
│   └── Dockerfile
├── camera/                  # Person detection service
│   ├── camera_service.py
│   └── Dockerfile
├── docker-compose.yml       # Service orchestration
├── start-mirror.sh         # Launch script
└── README.md               # This file
```

---

## 🤝 Contributing

This is a student project. Feel free to fork and customize for your own smart mirror!

---

## 📝 License

This project is provided as-is for educational purposes.

---

## 🙏 Acknowledgments

- **ESPN API** - Sports scores
- **OpenWeather API** - Weather data
- **Google APIs** - Calendar, Maps, Directions
- **Tailscale** - Secure remote access
- **Docker** - Containerization
- **React** - UI framework

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review container logs: `docker compose logs -f`
3. Verify API keys are configured correctly
4. Ensure all containers are running: `docker compose ps`

---

**Built with ❤️ on Raspberry Pi 5**
