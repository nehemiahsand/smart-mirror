# Smart Mirror

Smart mirror system for Raspberry Pi with three active surfaces:

- mirror display UI (React/Vite build served on port 3000)
- mobile/admin PWA (React/Vite build served by backend at /)
- ESP32 OLED + five-button console (MQTT input + HTTP state polling)

## Current Runtime

Docker Compose runs four services:

- mosquitto: authenticated MQTT broker for ESP32 events
- camera: MJPEG sidecar with camera enable/disable support (internal port 5556)
- backend: Node/Express API + WebSocket + scene/console logic + built PWA (host port 80)
- display: mirror React app bundle served from a container on host port 3000

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
  - widget pages stay mounted while another page is active so navigating back
    to home does not refetch external data
  - traffic widget renders one row per `traffic.destinations[]` entry (label +
    minutes + live ETA), sharing one origin and per-route caching
- fun: fun page content from backend (/api/console/page/fun)
- spotify: full Spotify player page
- standby: display-only standby screen when display.standbyMode is true

ESP32 OLED behavior:

- screen modes: page, standby, stats
- button 1 short press: page toggle (home → fun → spotify → home)
- button 1 hold: enter standby when awake
- on spotify: button2 play/pause, button3 prev, button4 next
- on home: buttons map to sports shortcuts from backend soft buttons
- on fun:
  - button2: previous highlight/game
  - button3: next highlight/game
  - button4: toggle `Video` ↔ `Box` view for the selected game
  - the matchup banner (team/logo/score/result) stays visible in both views
- button 5: stats overlay toggle
- in standby: button1 shows Turn On and wakes mirror, button5 shows Stats
- in stats: short button1 is ignored, hold button1 enters standby

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
- USB camera
- USB microphone
- HDMI display
- ESP32 console:
  - DHT22 data GPIO14
  - button1 GPIO32
  - button2 GPIO26
  - button3 GPIO27
  - button4 GPIO25
  - button5 GPIO23
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
- FUN_VIDEO_MODE (`search` or `game_recap`)
- FUN_VIDEO_TEAM_ID (ESPN NBA team id, `9` for Warriors)

Runtime settings are stored in backend/data/settings.json.

Traffic widget settings (under the `traffic` key):

- `enabled`: boolean
- `origin`: address or `"lat,lng"` string (lat,lng skips geocoding entirely)
- `destinations`: array of `{ label, address }` (preferred; widget renders one
  row per entry)
- `destination`: legacy single-destination string, used only when
  `destinations` is empty
- `tomtomApiKey` / `googleMapsApiKey`: provider key (TomTom preferred)

Backend caches each origin→destination route for 10 minutes, so N destinations
cost ~N routing calls per refresh.

## Start, Check, and Verify

Start the core services manually:

```bash
docker compose up -d --build
```

For boot-time startup on the Pi, enable only the main mirror service:

```bash
sudo ln -s /home/smartmirror/Downloads/smart-mirror/deploy/systemd/smart-mirror.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now smart-mirror.service
```

Network note:

- the mirror no longer creates any fallback Wi-Fi hotspot or setup access point
- provision it onto a trusted network before relying on unattended boot

Status:

```bash
docker compose ps
```

### Auto-Deployment (CD) Setup

You can configure the mirror to automatically download and deploy updates pushed to the `main` branch.
The updater checks every 5 minutes and only deploys when the local checkout is behind `origin/main`.
If the local branch is ahead of or diverged from `origin/main`, it skips deployment instead of restarting containers repeatedly.

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

Google Calendar token persistence: the backend always merges new tokens with
existing ones so the long-lived `refresh_token` survives subsequent
authorizations, and re-auth requests force a consent prompt to recover when
Google has revoked the refresh token.

Spotify local auth helper (run on a machine that has a browser, no SSH tunnel
required — uses the loopback callback `http://127.0.0.1:8888/callback`):

```bash
MIRROR_URL=http://<pi-ip> ADMIN_PASSWORD=<password> \
  node scripts/spotify-auth.mjs
```

The script logs into the mirror admin API, opens the Spotify auth URL in your
browser, captures the code on `127.0.0.1:8888`, and posts the resulting tokens
back to the mirror via `POST /api/spotify/authorize`. Status and a disconnect
button live on the PWA Settings page.

The older in-repo helper still works on the Pi itself:

```bash
cd backend
npm run spotify:auth
```

## Notes

- The backend image builds mobile-pwa into backend/public.
- The display image builds the React app during `docker compose build` and serves the compiled bundle at runtime; it does not run the Vite dev server in Docker.
- There is no separate PWA compose service.
- Camera service is stream/control support; standby is now manual from the dashboard or ESP32 button 1 hold.
- Standby turns the display off but does not disable camera streaming for the PWA unless Camera Input is explicitly disabled.
- The Camera page uses short-lived scoped stream tokens and refreshes the MJPEG stream periodically so long-lived sessions recover cleanly.

## Author

- Nehemiah Sanders
