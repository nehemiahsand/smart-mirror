# Smart Mirror

Smart mirror system for Raspberry Pi with a dedicated display UI, an admin/mobile PWA, offline voice control, camera-driven standby, and an ESP32 OLED/button console.

## Current Stack

The current Docker Compose stack runs six services:

- `mosquitto`: authenticated internal MQTT broker for the ESP32 console
- `sensor`: DHT22 sidecar on GPIO
- `camera`: ffmpeg + MediaPipe based detection service
- `backend`: Node/Express API, WebSocket hub, settings, auth, ESP32 scene/console logic, and the built PWA
- `display`: React/Vite mirror display on port `3000`
- `voice`: offline Vosk-based voice control service

The backend is exposed on host port `80` and serves both:

- the REST/WebSocket API at `/api/...`
- the built mobile/admin PWA at `/`

## Current User-Facing Features

- Mirror display with two synced pages: `home` and `spotify`
- Mobile/admin PWA served by the backend
- Offline voice control with page-aware Spotify/navigation commands
- Camera-controlled person detection and dark-room standby
- PIR-first wake path through the ESP32 console
- ESP32 OLED/button console with MQTT input and HTTP state polling
- Weather, traffic, sports, photos, Google Calendar, Spotify, and sensor data
- Admin session auth with hardened write routes and redacted settings output

## Current Hardware

- Raspberry Pi 5
- DHT22 on GPIO `4`
- USB camera
- USB microphone
- HDMI-connected mirror display
- ESP32 console with:
  - button 1 on `GPIO32`
  - button 2 on `GPIO26`
  - button 3 on `GPIO27`
  - button 4 on `GPIO25`
  - button 5 on `GPIO23`
  - PIR motion on `GPIO33`
  - SSD1306 OLED on `GPIO21`/`GPIO22`

## Start and Access

Build and start everything:

```bash
docker compose up -d --build
```

Check service state:

```bash
docker compose ps
```

Main entry points:

- mirror display: `http://<pi-ip>:3000`
- admin/mobile PWA: `http://<pi-ip>/`
- API: `http://<pi-ip>/api`
- MQTT broker: `<pi-ip>:1883`

## Local Configuration

The repo expects local secrets in `backend/.env` and `esp32-console/include/config.local.h`.

Important backend env values:

- `API_KEY`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`
- `OPENWEATHER_API_KEY`
- `TOMTOM_API_KEY` or traffic API config used in settings
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`

Local-only ESP32 config:

- Wi-Fi SSID/password
- backend base URL
- MQTT host/port/credentials

`backend/data/settings.json` is local runtime data, not source-of-truth documentation. Sensitive settings are redacted from API responses.

## OAuth Helpers

Spotify local auth helper:

```bash
cd backend
npm run spotify:auth
```

Google Calendar still uses the backend authorization routes and stored credentials under `backend/data/`.

## ESP32 Console Behavior

The ESP32 console mirrors the actual mirror page state.

Normal pages:

- `Main Page`
- `Spotify`

Button behavior:

- button 1 toggles between `home` and `spotify`
- on Spotify, button 2 is `Play/Pause`
- on Spotify, button 3 is `Prev`
- on Spotify, button 4 is `Next`
- button 5 toggles the OLED stats overlay

Standby behavior:

- PIR motion wakes the mirror
- standby disables camera input
- button 1 shows `Turn On`
- button 5 opens the OLED stats overlay without printing a separate close label

## Development Notes

- The backend image builds the PWA bundle into `backend/public`
- There is no separate PWA container in the current compose file
- The display app is still a separate container on port `3000`
- The voice service is offline/local via Vosk, not cloud speech recognition
- The camera service uses MediaPipe pose landmarks and MJPEG capture, not the older Haar-cascade flow

## Verification Commands

Useful checks:

```bash
docker compose ps
curl http://localhost/api/health
curl http://localhost/api/privacy/status
curl http://localhost/api/console/state?device=esp32
./scripts/security-smoke-test.sh
```

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
