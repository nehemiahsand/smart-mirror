# Smart Mirror Testing

Testing is currently based on targeted smoke checks plus hardware validation.

## 1) Build and Startup

```bash
docker compose up -d --build
docker compose ps
```

Expected: services mosquitto, sensor, camera, backend, and display are healthy/running.

## 2) Backend/API Smoke Checks

```bash
curl http://localhost/api/health
curl http://localhost/api/privacy/status
curl 'http://localhost/api/console/state?device=esp32'
curl http://localhost/api/scene/state
```

Key console state fields to verify:

- screenMode
- activePageId
- softButtons.button1 .. button5
- statsLine1 .. statsLine4

## 3) Security Smoke Test

```bash
./scripts/security-smoke-test.sh
```

Current script coverage includes:

- admin login/session/logout path
- login rate limiting behavior
- oauth state validation checks

## 4) Display + PWA Manual Validation

Display:

- open http://localhost:3000
- verify page cycle support for home, fun, spotify
- verify standby screen when display.standbyMode is true

PWA:

- open http://localhost/
- verify login gate works
- verify dashboard, camera, wifi, widgets, photos, sports, settings, and more pages load

## 5) ESP32/OLED Validation

After firmware flash:

```bash
cd esp32-console
~/.venv-pio/bin/pio run
~/.venv-pio/bin/pio device monitor
```

Validate:

- button1 toggles home -> fun -> spotify -> home
- spotify page button2/3/4 map to play-pause/prev/next
- button5 toggles stats overlay
- standby shows Turn On and can wake via button1 or PIR motion
- oled receives current state from /api/console/state?device=esp32

## 6) Useful Logs

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 display
docker compose logs --tail=200 mosquitto
docker compose logs --tail=200 camera
docker compose logs --tail=200 sensor
```

## Document Metadata

- Version: 1.1
- Last Updated: March 18, 2026
