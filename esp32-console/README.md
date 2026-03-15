# ESP32 Console Firmware

Fresh PlatformIO scaffold for the smart mirror ESP32 console.

Hardware mapping in this rebuild:

- `GPIO 25`: button 1 / previous
- `GPIO 26`: button 2 / next
- `GPIO 27`: button 3 / primary
- `GPIO 32`: button 4 / back
- `GPIO 34`: analog knob
- `GPIO 33`: PIR motion sensor
- `GPIO 21`: OLED SDA
- `GPIO 22`: OLED SCL

What this firmware does:

- connects to Wi-Fi
- publishes MQTT status and input events
- polls the mirror backend for OLED labels when available
- renders mirror state to a `128x64` I2C SSD1306 display

MQTT topics:

- `smartmirror/esp32/<deviceId>/status`
- `smartmirror/esp32/<deviceId>/event`

Published event types:

- `ui.action`
- `ui.adjust`
- `motion.active`
- `motion.idle`

Before flashing:

1. Copy `include/config.example.h` to `include/config.local.h`.
2. Fill in your Wi-Fi, MQTT broker, MQTT credentials, and backend base URL in `config.local.h`.
3. Build from `esp32-console/` with PlatformIO.

Example:

```bash
cd esp32-console
cp include/config.example.h include/config.local.h
~/.venv-pio/bin/pio run
```

Security notes:

- `include/config.local.h` is ignored by git and is the only place real device credentials should live.
- `include/config.h` is just a tracked wrapper that loads `config.local.h`.
- Keep `MQTT_USERNAME` and `MQTT_PASSWORD` in sync with the local values in `backend/.env`.
- Do not commit real Wi-Fi credentials, LAN IPs, or broker settings back into the repo.
