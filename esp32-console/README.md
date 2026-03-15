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

1. Edit `include/config.h`.
2. Set your Wi-Fi, MQTT broker, and backend base URL.
3. Build from `esp32-console/` with PlatformIO.

Example:

```bash
cd esp32-console
~/.venv-pio/bin/pio run
```
