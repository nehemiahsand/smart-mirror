# ESP32 Console Firmware

PlatformIO firmware for the mirror-side ESP32 console.

## Current Pin Map

- `GPIO32`: button 1
- `GPIO26`: button 2
- `GPIO27`: button 3
- `GPIO25`: button 4
- `GPIO23`: button 5
- `GPIO21`: OLED SDA
- `GPIO22`: OLED SCL
- `GPIO14`: DHT22 data

The knob has been removed from the current firmware.

## Current Display Assumptions

- SSD1306 I2C OLED
- `128x32` layout in the current local config
- monochrome black/white rendering only
- paged stats overlay optimized for the compact `128x32` layout

## What the Firmware Does

- connects to Wi-Fi
- connects to the authenticated Mosquitto broker
- publishes ESP32 button events over MQTT
- polls `GET /api/console/state?device=esp32`
- renders the returned mirror state onto the OLED

## Current MQTT Contract

Topics:

- `smartmirror/esp32/<deviceId>/status`
- `smartmirror/esp32/<deviceId>/event`

Published event types:

- `display.page.toggle`
- `ui.action`

The backend is the source of truth for page state, standby state, and OLED labels.

`display.page.toggle` uses its `hold` flag for standby control:

- `hold: false`: cycle pages while awake, wake the mirror while in standby
- `hold: true`: enter standby while awake, wake the mirror while in standby

## Current OLED Behavior

Awake pages are Main Page, Weather, Sports, and Spotify, plus the Stats overlay.

Buttons:

- Button 1 cycles enabled pages; holding it enters standby.
- Main Page: buttons 2/3 change the scoreboard sport; button 4 restores its default.
- Weather: button 2 refreshes weather.
- Sports highlights: buttons 2/3 select previous/next games; button 4 switches Video/Box.
- Sports live tracker: buttons 2/3 select live games; button 4 returns to highlights.
- **Sports button 5 switches GSW ↔ Auburn.** Its label shows the destination (`To Auburn` / `To GSW`). Each switch saves the highlight team, selects its latest game in video mode, and returns from a live tracker to highlights. Automatic live-game preferences and priority are preserved.
- Spotify: buttons 2/3 change tracks; button 4 plays/stops.
- Button 5 opens Stats on the other pages and returns from the Stats overlay.

Team switching uses the existing `ui.action` payload and backend-supplied labels, so no firmware reflash is required. See [Console team switching](../docs/NEXUS_CONSOLE_TEAM_SWITCH.md).

Standby:

- button 1 wakes the mirror
- button 5 can still open stats
- standby only turns the display off; the backend camera stream can still be opened from the admin PWA unless Camera Input is disabled separately

Stats pages:

- disk and ping
- CPU and RAM
- uptime and CPU temp

While stats is open:

- button 2 = previous stats page
- button 3 = next stats page
- button 5 = back/close
- short button 1 and button 4 are ignored to keep the stats layout uncluttered
- hold button 1 enters standby

## Local Setup

Create the untracked local config:

```bash
cd esp32-console
cp include/config.example.h include/config.local.h
```

Then fill in:

- Wi-Fi SSID/password
- backend base URL
- MQTT host/port
- MQTT username/password

## Build and Flash

Build:

```bash
cd esp32-console
~/.venv-pio/bin/pio run
```

Upload:

```bash
cd esp32-console
~/.venv-pio/bin/pio run -t upload
```

Serial monitor:

```bash
cd esp32-console
~/.venv-pio/bin/pio device monitor
```

## Security Notes

- `include/config.local.h` is git-ignored and is the only place for real ESP32 secrets
- `include/config.h` is a tracked wrapper that only loads `config.local.h`
- the MQTT credentials must match `backend/.env`
- do not commit Wi-Fi credentials, LAN IPs, or broker credentials
