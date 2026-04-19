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

## Current OLED Behavior

Awake pages:

- `Main Page`
- `Fun`
- `Spotify`
- `Stats` overlay

Buttons:

- button 1 cycles between `Main Page`, `Fun`, and `Spotify`
- hold button 1 to enter standby
- on Main Page:
  - button 2 = `Prev`
  - button 3 = `Next`
  - button 4 = `Default`
- on Fun:
  - button 2 = `Prev`
  - button 3 = `Next`
  - button 4 = `Video` / `Box` toggle
  - the Fun matchup banner (teams, logos, score, result) remains visible in both modes
- on Spotify:
  - button 2 = `Prev`
  - button 3 = `Next`
  - button 4 = `Play` or `Stop`
- button 5 toggles the stats overlay

Standby:

- button 1 wakes the mirror
- button 5 can still open stats

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
