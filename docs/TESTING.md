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
- main page button2/3/4 map to prev sport/next sport/default sport
- fun page button2/3/4 map to prev date/next date/home
- spotify page button2/3/4 map to prev/next/play-stop
- button5 toggles stats overlay
- stats overlay uses paged views:
  - button2 = previous stats page
  - button3 = next stats page
  - button5 = back
- stats pages render cleanly without overlapping the header on the compact 128x32 OLED
- standby shows Turn On and can wake via button1 or PIR motion
- oled receives current state from /api/console/state?device=esp32
- after 5 minutes of inactivity on spotify or fun, both the OLED and mirror return to home together

## 6) Useful Logs

```bash
docker compose logs --tail=200 backend
docker compose logs --tail=200 display
docker compose logs --tail=200 mosquitto
docker compose logs --tail=200 camera
docker compose logs --tail=200 sensor
```

## Document Metadata

- Version: 1.3
- Last Updated: March 23, 2026

## 7) Automated Unit Testing (Jest)

The backend now uses Jest to provide rigorous hardware-abstraction and security testing entirely independent of physical Raspberry Pi constraints. 

To run the complete test suite locally:

```bash
cd backend
npm install
npm test
```

### Test Coverage Highlights
* **Security & Authorization:**
  * `apiKey.test.js`: Validates `503` misconfiguration blocks and `401` header rejection.
  * `adminAuth.test.js`: Asserts admin role payload verification on secure tokens.
  * `cameraStreamAuth.test.js`: Verifies the specific `camera:stream` audience pipeline and intercepts bad stream-tokens.
  * `redaction.test.js`: Validates the `redactSensitive` generic utility cleanly masks credentials.
* **Frontend Payload Integrity:**
  * `settings.test.js`: Validates DOT-notation nested schema merging and factory defaults fallback.
  * `layoutAPI.test.js`: Spins up a mocked `supertest` Express web server to enforce payload requirements for the UI coordinates, and verifies layout updates properly trigger a Websocket broadcast.

Continuous Integration (CI) automatically executes `npm test` on every push to the `main` repo branch.
