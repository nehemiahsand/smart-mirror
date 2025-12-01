# Smart Mirror Backend

Node.js Express backend for Raspberry Pi 5 Smart Mirror with real-time sensor data, weather updates, Google Calendar/Photos integration, and WiFi provisioning.

## Features

- **REST API** - Settings, WiFi, sensor data, weather, calendar, photos, and display power control
- **WebSocket Server** - Real-time data push via Socket.IO
- **DHT22 Sensor Integration** - Proxy to Python Flask sensor service (Port 5555)
- **Weather Service** - OpenWeather API with caching
- **Google Calendar** - OAuth 2.0 authentication and event sync
- **Local Photos** - Photo file management with metadata and ordering
- **Display Power Control** - LCD backlight via wlr-randr (Wayland), DPMS, vcgencmd fallbacks
- **WiFi Provisioning** - NetworkManager D-Bus integration for scanning and connecting
- **Settings Management** - JSON-based persistent storage in `/app/data/settings.json`
- **Docker Support** - Fully containerized with privileged access for system control

## Prerequisites

- **Hardware**: Raspberry Pi 5 (4GB+ recommended)
- **OS**: Raspberry Pi OS Bookworm with Wayland
- **Runtime**: Node.js 18+ or Docker
- **Sensors**: DHT22 sensor on GPIO 4 (optional)
- **Display**: LCD monitor with HDMI connection
- **Network**: NetworkManager for WiFi control
- **APIs**:
  - OpenWeather API key (free at https://openweathermap.org/api)
  - Google Cloud Console project with Calendar API enabled
  - OAuth 2.0 credentials for Google Calendar

## Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
nano .env
```

3. Add your OpenWeather API key to `.env`:
```
OPENWEATHER_API_KEY=your_actual_api_key_here
```

## Running the Server

### With Docker (Recommended)
```bash
# From project root
docker compose up -d backend

# View logs
docker compose logs -f backend

# Restart
docker compose restart backend
```

### Development Mode (Local)
```bash
npm run dev
```

### Production Mode (Local)
```bash
npm start
```

**Note**: Docker deployment is recommended as it handles all system dependencies, privileged access, and service integration automatically.

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Settings
- `GET /api/settings` - Get all settings
- `GET /api/settings/:key` - Get specific setting
- `PUT /api/settings/:key` - Update single setting
- `PUT /api/settings` - Update multiple settings
- `POST /api/settings/reset` - Reset to defaults

### Weather
- `GET /api/weather/current?city=London&units=metric` - Current weather
- `GET /api/weather/forecast?city=London&units=metric` - Weather forecast
- `POST /api/weather/cache/clear` - Clear weather cache

### Google Calendar
- `GET /api/calendar/events` - Get upcoming calendar events
- `GET /api/calendar/auth-url` - Get OAuth authorization URL
- `GET /api/calendar/auth-status` - Check if calendar is authorized
- `POST /api/calendar/clear-token` - Clear OAuth token

### Local Photos
- `GET /api/photos` - Get photos metadata from local directory
- `POST /api/photos/order` - Update photo display order
- `POST /api/photos/refresh` - Rescan local photos directory
- `POST /api/photos/upload` - Upload new photo (multipart/form-data)

### Display Power Control
- `POST /api/display/power` - Control LCD backlight
  ```json
  {
    "state": "off"  // or "on"
  }
  ```

### WiFi
- `GET /api/wifi/status` - Current WiFi status
- `GET /api/wifi/scan` - Scan for networks
- `POST /api/wifi/connect` - Connect to network
  ```json
  {
    "ssid": "NetworkName",
    "password": "password123"
  }
  ```
- `POST /api/wifi/disconnect` - Disconnect from WiFi

### Sensor
- `GET /api/sensor/dht22` - Read DHT22 sensor (proxied to Python service)
- `GET /api/sensor/status` - Sensor availability and last reading

### Power
- `POST /api/power/reboot` - Reboot the Raspberry Pi

### System
- `GET /api/system/info` - System information

## WebSocket Events

Connect to `ws://your-pi-ip:3001` using Socket.IO client

### Server to Client Events
- `connected` - Connection established
- `sensor_data` - Real-time DHT22 readings (every 2 seconds)
  ```json
  {
    "temperature": 22.5,
    "humidity": 45.0,
    "timestamp": "2025-11-30T12:00:00.000Z"
  }
  ```
- `weather_data` - Weather updates (every 5 minutes)
- `settings_update` - Settings changed notification
- `calendar_update` - Calendar events updated
- `photos_update` - Local photos metadata updated

### Client to Server Events
- `ping` - Keep-alive ping
- `pong` - Server responds with pong

## Configuration

### Environment Variables
Create a `.env` file in the `backend` directory:

```bash
# OpenWeather API
OPENWEATHER_API_KEY=your_openweather_api_key

# Google Calendar/Photos OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Server Configuration
PORT=3001
NODE_ENV=production

# Sensor Configuration
SENSOR_URL=http://localhost:5555
DHT22_GPIO_PIN=4
```

### Settings File
Settings are stored in `/app/data/settings.json` (Docker) or `./data/settings.json` (local).

Default settings structure:
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
  "widgets": {
    "timedate": true,
    "googlecalendar": true,
    "weathertemp": true,
    "photos": true
  },
  "network": {
    "ssid": "YourWiFiNetwork",
    "connected": true
  }
}
```

### Google Calendar OAuth Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google Calendar API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Download credentials and save as `backend/data/calendar-credentials.json`
5. Run `node backend/authorize-calendar.js` to generate OAuth token
6. Token will be saved to `backend/data/calendar-token.json`

### Local Photos Setup

1. Photos are stored in `backend/data/photos/` directory
2. Supported formats: JPG, JPEG, PNG, GIF, WebP
3. Add photos by copying files to the directory or using the PWA upload feature
4. Metadata (order, filenames) stored in `backend/data/photos-metadata.json`
5. Use PWA Photos tab to reorder photos with drag-and-drop

## Display Power Control

The backend can control the LCD backlight power state using multiple methods:

1. **wlr-randr** (Primary, Wayland): `wlr-randr --output HDMI-A-1 --off/--on`
2. **vcgencmd** (Fallback, older Pi models): `vcgencmd display_power 0/1`
3. **DPMS** (Fallback, X11): `xset dpms force off/on`
4. **vbetool** (Last resort): `vbetool dpms off/on`

Docker container has:
- Wayland socket mounted at `/run/user/1000`
- `WAYLAND_DISPLAY=wayland-0` environment variable
- `wlr-randr` package installed
- Privileged access for system control

## DHT22 Sensor

The backend proxies sensor requests to a dedicated Python Flask service running on port 5555.

**Python Service** (in `sensor/` directory):
- Runs `dht22_server.py` using Adafruit DHT library
- Requires privileged GPIO access
- Reads from GPIO pin 4 by default
- Returns JSON: `{"temperature": 22.5, "humidity": 45.0}`

**Backend Integration**:
- Polls sensor every 2 seconds via `/sensor/read` endpoint
- Broadcasts data to all WebSocket clients
- Caches last reading for HTTP API responses

## WiFi Provisioning

WiFi management uses NetworkManager via D-Bus interface.

**Docker Requirements**:
- `/var/run/dbus` socket mounted
- `/run/NetworkManager` mounted read-only
- Privileged mode for network operations

**Hotspot Mode**:
When no known WiFi network is available, the system can create a hotspot:
- SSID: `SmartMirror-Setup`
- IP: `10.42.0.1`
- All services accessible on this IP
- Connect via PWA at `http://10.42.0.1:3002` to configure WiFi

## Troubleshooting

**Sensor not working:**
- Verify sensor service is running: `docker compose ps sensor`
- Check sensor logs: `docker compose logs sensor`
- Ensure GPIO devices are mounted in container
- Test sensor endpoint: `curl http://localhost:5555/sensor/read`

**Weather not updating:**
- Verify API key in `.env` file
- Check internet connection
- Check API quota at OpenWeather dashboard
- Clear cache: `curl -X POST http://localhost:3001/api/weather/cache/clear`

**Display power control fails:**
- Verify Wayland is running: `echo $WAYLAND_DISPLAY`
- Check wlr-randr is installed in container: `docker exec smart-mirror-backend which wlr-randr`
- Verify Wayland socket is mounted: `ls -la /run/user/1000/wayland-0`
- Test manually: `wlr-randr --output HDMI-A-1 --off`

**Google Calendar not syncing:**
- Check OAuth credentials exist in `data/calendar-credentials.json`
- Verify token file exists: `data/calendar-token.json`
- Re-run authorization: `node authorize-calendar.js`
- Check Calendar API is enabled in Google Cloud Console
- Verify OAuth consent screen is configured

**Photos not showing:**
- Verify photos exist in `backend/data/photos/` directory
- Check supported formats: .jpg, .jpeg, .png, .gif, .webp
- Ensure metadata file is not corrupted: `data/photos-metadata.json`
- Refresh photos from PWA Photos tab
- Check photos service logs: `docker compose logs backend | grep -i photo`

**WiFi commands fail:**
- Ensure D-Bus socket is mounted in Docker
- Check NetworkManager is running on host: `systemctl status NetworkManager`
- Verify wlan0 interface exists: `ip link show wlan0`
- Check container has privileged access

## License

MIT
