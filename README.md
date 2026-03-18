# Smart Mirror

Smart mirror system for Raspberry Pi with three active surfaces:

- mirror display UI (React/Vite, port 3000)
- mobile/admin PWA (React/Vite build served by backend at /)
- ESP32 OLED + five-button console (MQTT input + HTTP state polling)

## Current Runtime

Docker Compose runs five services:

- mosquitto: authenticated MQTT broker for ESP32 events
- sensor: DHT22 sidecar (internal port 5555)
- camera: MJPEG sidecar with camera enable/disable support (internal port 5556)
- backend: Node/Express API + WebSocket + scene/console logic + built PWA (host port 80)
- display: mirror React app (host port 3000)

Main entry points:

- Display: http://<pi-ip>:3000
- PWA: http://<pi-ip>/
- API: http://<pi-ip>/api
- MQTT: <pi-ip>:1883

## Active UX Model

The mirror and OLED are synchronized around three pages:

- home
- fun
- spotify

Display behavior:

- home: widgets (time/date, weather+traffic, calendar, sports, photos)
- fun: fun page content from backend (/api/console/page/fun)
- spotify: full Spotify player page
- standby: display-only standby screen when display.standbyMode is true

ESP32 OLED behavior:

- screen modes: page, standby, stats
- button 1: page toggle (home → fun → spotify → home)
- on spotify: button2 play/pause, button3 prev, button4 next
- on fun/home: buttons map to fun navigation/sports shortcuts from backend soft buttons
- button 5: stats overlay toggle
- in standby: button1 shows Turn On and wakes mirror, button5 shows Stats

PWA pages (current):

- dashboard
- wifi
- camera
- widgets
- photos
- sports
- settings
- more
- login

## Hardware

- Raspberry Pi 5
- DHT22 on GPIO 4
- USB camera
- USB microphone
- HDMI display
- ESP32 console:
  - button1 GPIO32
  - button2 GPIO26
  - button3 GPIO27
  - button4 GPIO25
  - button5 GPIO23
  - PIR GPIO33
  - SSD1306 OLED on GPIO21/GPIO22

## Local Configuration

Local secrets/config expected in:

- backend/.env
- esp32-console/include/config.local.h

Important backend env values:

- API_KEY
- ADMIN_PASSWORD
- AUTH_SECRET
- OPENWEATHER_API_KEY
- SPOTIFY_CLIENT_ID
- SPOTIFY_CLIENT_SECRET
- SPOTIFY_REDIRECT_URI
- MQTT_USERNAME
- MQTT_PASSWORD

Runtime settings are stored in backend/data/settings.json.

## Start, Check, and Verify

Start:

```bash
git clone https://github.com/[your-repo]/smart-mirror.git
cd smart-mirror
```

## Start, Check, and Verify

Start the core services manually:

```bash
docker compose up -d --build
```

Status:

```bash
docker compose ps
```

### Auto-Deployment (CD) Setup

You can configure the mirror to automatically download and deploy updates pushed to the `main` branch.

```bash
# Link the auto-updater systemd files
sudo ln -s /home/smartmirror/Downloads/smart-mirror/deploy/systemd/smart-mirror-updater.service /etc/systemd/system/
sudo ln -s /home/smartmirror/Downloads/smart-mirror/deploy/systemd/smart-mirror-updater.timer /etc/systemd/system/

# Enable and start the timer
sudo systemctl daemon-reload
sudo systemctl enable --now smart-mirror-updater.timer
```

Useful checks:

```bash
curl http://localhost/api/health
curl http://localhost/api/privacy/status
curl 'http://localhost/api/console/state?device=esp32'
./scripts/security-smoke-test.sh
```

## Data Flow (Current)

- Display ↔ backend WebSocket for settings/page/state updates
- PWA → backend REST (+ auth cookies)
- ESP32 → mosquitto MQTT events → backend scene/console services
- ESP32 → backend /api/console/state?device=esp32 for compact OLED state
- Backend → weather/traffic/calendar/spotify external APIs

## OAuth Helper

Spotify local auth helper:

```bash
cd backend
npm run spotify:auth
```

## Notes

- The backend image builds mobile-pwa into backend/public.
- There is no separate PWA compose service.
- Camera service is stream/control support; standby wake source is PIR motion via ESP32.

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
