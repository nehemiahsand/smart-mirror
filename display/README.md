# Smart Mirror Display UI

Fullscreen React display interface for the Smart Mirror with dark glass aesthetic and real-time widget updates.

## Features

- **Dark Glass Aesthetic** - Beautiful gradient background with glass morphism effects
- **No Scrollbars** - Fullscreen immersive experience
- **Real-time Updates** - Socket.IO WebSocket connection for live data
- **4 Active Widgets**:
  - ⏰ **TimeDate** - Large centered clock with date (system time, offline-capable)
  - 🌤️ **WeatherTemp** - Current weather, temperature, sunrise/sunset (OpenWeather API)
  - 📅 **GoogleCalendar** - Upcoming events from Google Calendar (OAuth 2.0)
  - 📸 **Photos** - Local photo slideshow with drag-drop ordering
- **Standby Mode** - Black screen overlay for power saving
- **Message Overlay** - Display notifications and alerts
- **Auto Layout Updates** - Responds to settings changes from PWA
- **Connection Status** - Visual indicator for WebSocket connection
- **Absolute Positioning** - Widgets use percentage-based positioning for responsive layout

## Component Structure

```
src/
├── App.jsx                      # Main application with widget rendering
├── App.css                      # Dark glass mirror styling
├── main.jsx                     # Entry point
├── index.css                    # Global styles
├── components/
│   ├── LayoutContainer.jsx      # Absolute positioning container
│   ├── LayoutContainer.css      # Layout styles
│   ├── MessageOverlay.jsx       # Popup messages and notifications
│   ├── StandbyMode.jsx          # Black screen overlay for standby
│   └── StatusIndicator.jsx      # WebSocket connection status
├── widgets/
│   ├── TimeDate.jsx             # Combined clock + date widget
│   ├── TimeDate.css             # TimeDate styling
│   ├── WeatherTemp.jsx          # Weather + temperature widget
│   ├── WeatherTemp.css          # Weather styling
│   ├── GoogleCalendar.jsx       # Google Calendar events widget
│   ├── GoogleCalendar.css       # Calendar styling
│   ├── Photos.jsx               # Photo slideshow widget
│   ├── Photos.css               # Photos styling
│   └── index.js                 # Widget exports
└── hooks/
    ├── useWebSocket.js          # Socket.IO WebSocket hook
    └── useLayoutEngine.js       # Layout positioning logic
```

## Installation

```bash
cd display
npm install
```

## Configuration

Create a `.env` file:
```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

For Raspberry Pi, use your Pi's IP address:
```
VITE_API_URL=http://<pi-ip>:3001
VITE_WS_URL=ws://<pi-ip>:3001
```

Or use Tailscale IP for remote access:
```
VITE_API_URL=http://100.120.146.19:3001
VITE_WS_URL=ws://100.120.146.19:3001
```

## Development

```bash
npm run dev
```

Visit `http://localhost:3000`

## Production Build

```bash
npm run build
npm run preview
```

## Running on Raspberry Pi

### With Docker (Recommended)
```bash
# From project root
docker compose up -d display

# View logs
docker compose logs -f display
```

### Manual Start
```bash
# Start on all network interfaces
npm start
```

Access from any device on your network at:
- Local: `http://<pi-ip>:3000`
- Tailscale: `http://100.120.146.19:3000`

## WebSocket Events

The display uses Socket.IO and automatically receives:

### Incoming Events
- `connected` - Connection established
- `sensor_data` - DHT22 temperature/humidity (every 2 seconds)
  ```json
  {
    "temperature": 22.5,
    "humidity": 45.0,
    "timestamp": "2025-11-30T12:00:00.000Z"
  }
  ```
- `weather_data` - Weather updates (every 5 minutes)
- `calendar_update` - Calendar events refreshed
- `photos_update` - Photos metadata updated
- `settings_update` - Widget visibility or settings changed
  ```json
  {
    "widgets": {
      "timedate": true,
      "googlecalendar": true,
      "weathertemp": true,
      "photos": true
    }
  }
  ```
- `display_message` - Show popup message
- `standby_mode` - Enter/exit standby mode

### Outgoing Events
- `ping` - Keep-alive heartbeat
- Server responds with `pong`

## Widget Layout

Widgets use absolute positioning with percentage-based coordinates from `settings.json`:

```json
{
  "widgetPositions": {
    "timedate": { "top": "35%", "left": "50%", "transform": "translate(-50%, -50%)" },
    "weathertemp": { "top": "10%", "right": "5%" },
    "googlecalendar": { "top": "10%", "left": "5%" },
    "photos": { "bottom": "5%", "left": "50%", "transform": "translateX(-50%)" }
  }
}
```

**Active Widgets**:
1. **TimeDate** - Center of screen, large and prominent
2. **WeatherTemp** - Top right corner
3. **GoogleCalendar** - Top left corner  
4. **Photos** - Bottom center

Widget visibility is controlled via the PWA's Widget Manager.

## Browser Compatibility

- Chrome/Chromium (Recommended for Raspberry Pi)
- Firefox
- Safari
- Edge

## Fullscreen Mode

Press `F11` in browser for true fullscreen experience.

For kiosk mode on Raspberry Pi, see `start-display.sh` which uses Chromium:
```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --start-fullscreen \
  http://localhost:3000
```

## Standby Mode

The display includes a `StandbyMode` component that:
- Shows a black overlay when `display.standbyMode` setting is true
- Automatically refreshes weather/calendar data when exiting standby
- Controlled via PWA Dashboard or backend API
- Works in conjunction with LCD backlight control for power saving

## Performance

- Optimized for Raspberry Pi 5
- Minimal re-renders with React hooks and memoization
- Efficient Socket.IO WebSocket handling
- Hardware-accelerated CSS transforms
- Lazy loading for photos
- Debounced sensor updates (2 second intervals)

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server  
- **Socket.IO Client** - WebSocket communication
- **CSS3** - Glass morphism effects and animations
- **Docker** - Containerized deployment

## License

MIT
