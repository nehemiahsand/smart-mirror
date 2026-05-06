# Security Hardening Summary

Last updated: 2026-04-18

This repo currently runs with a hardened-by-default local deployment model. The items below reflect the current codebase and compose configuration.

## Authentication and Session Model

- backend startup fails closed if `API_KEY`, `ADMIN_PASSWORD`, or `AUTH_SECRET` are missing or weak
- admin login uses an `HttpOnly` session cookie, not browser-stored bearer tokens
- login rate limiting is enforced on `/api/auth/login`
- state-changing browser routes are admin-protected
- internal service routes use the internal API key where appropriate
- camera stream access uses short-lived scoped tokens

## API and WebSocket Surface

- public browser WebSocket connections are read/broadcast oriented
- client-issued WebSocket page sync is limited to allowed pages
- state-changing WebSocket command handling is not exposed to browsers
- `/api/settings` and `/api/settings/:key` require admin or internal API-key auth
- sensitive settings values are redacted in API responses and logs

## OAuth and Secret Handling

- Spotify and Google Calendar OAuth flows require validated `state`
- local secrets live in `backend/.env` and untracked ESP32 local config
- tracked frontend env files and browser API-key usage have been removed
- `backend/data/settings.json` remains local runtime state and is not intended for public exposure
- traffic origin/destination/destinations are treated as sensitive and redacted from settings responses

## Container Hardening

Current compose security posture:

- no `network_mode: host`
- `cap_drop: [ALL]` on services that can use it
- `security_opt: no-new-privileges:true`
- `read_only: true` plus `tmpfs` on the smaller sidecars where supported
- `camera` runs as non-root
- internal service traffic stays on the Compose network

Exposed host ports are currently limited to:

- `80` -> backend
- `3000` -> display
- `1883` -> mosquitto

## ESP32 / MQTT Hardening

- Mosquitto requires username/password auth
- broker credentials are generated from local `backend/.env` at startup
- ESP32 secrets live only in `esp32-console/include/config.local.h`
- the tracked ESP32 config files are templates/wrappers only
- backend MQTT ingestion accepts only expected topic shapes and allowed event types

## Runtime Behavior Protections

- standby no longer forces effective camera privacy state to off
- camera privacy is controlled independently from display standby
- ESP32 standby flow is button-driven rather than PIR-driven
- PWA camera streaming uses short-lived scoped tokens with reconnect-friendly client behavior
- the fallback Wi-Fi hotspot service has been removed; the mirror no longer exposes an open setup access point on boot

## Verification

The current security smoke test is:

```bash
./scripts/security-smoke-test.sh
```

It verifies:

- admin login/session/logout
- login lockout behavior
- Spotify invalid OAuth state rejection
- Google Calendar invalid OAuth state rejection
  - non-HTTP(S) origins
  - arbitrary public hostnames that happened to use common ports

### 20. Backend dependency tree remediated

- Updated backend package constraints in:
  - `backend/package.json`
  - `backend/package-lock.json`
- Upgraded or pinned safe versions for:
  - `axios`
  - `nodemon`
  - `googleapis`
  - `google-auth-library`
  - `gaxios`
  - `qs`
  - `body-parser`
- Replaced the legacy `dbus-next` dependency chain in:
  - `backend/src/services/power.js`
  - `backend/Dockerfile`
- Power control now uses `dbus-send` via `execFile` instead of a Node DBus client library.
- Result:
  - `npm audit --json` now reports `0` backend vulnerabilities
  - the vulnerable `request` / `node-gyp` / `tar` / `xml2js` chain was eliminated with the `dbus-next` removal

## New files added

- `backend/src/utils/redaction.js`
- `backend/src/middleware/adminOrApiKey.js`
- `backend/src/middleware/cameraStreamAuth.js`
- `backend/src/utils/loginRateLimit.js`
- `backend/src/utils/oauthState.js`
- `backend/src/utils/requestAuth.js`
- `.gitignore`
- `SECURITY_HARDENING_SUMMARY.md`

## Verification completed

- GitHub Actions (`.github/workflows/ci.yml`) is active, enforcing `npm audit` and Jest boundary tests on all commits.
- Systemd `.timer` is active (`smart-mirror-updater.timer`), providing fully automated Continuous Deployment (CD) with fast-forward-only updates when the local checkout is behind `origin/main`.
- `node --check` passed on modified backend files.
- `python3 -m py_compile` passed for:
  - `camera/camera_service.py`
- `npm run build` passed in:
  - `mobile-pwa`
  - `display`
- `docker compose config` passed.
- `docker compose up -d --build` completed successfully after follow-up runtime fixes.
- Live smoke tests passed for:
  - `GET /api/health`
  - `GET /api/sensor`
  - `GET /api/camera/status`
  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `POST /api/auth/logout`
  - `GET /api/spotify/auth-url`
  - `GET /api/calendar/auth-url`
- Camera-specific follow-up verification passed for:
  - rebuilt `camera` service for lightweight MJPEG streaming
  - `docker inspect ... ReadonlyRootfs => true`
- Final hardening verification passed for:
  - `./scripts/security-smoke-test.sh`
  - server-side admin session revocation (`GET /api/auth/session` changed from `200` before logout to `401` after logout using the same cookie jar)
  - camera raw stream access with a short-lived JWT stream token (`GET /api/camera/raw?streamToken=...` returned `200`)
  - `GET /api/power/status` returned `{"available":true,"tokenConfigured":true}` after the `dbus-send` migration
  - backend `npm audit --json` returned `0` vulnerabilities

## Next task note

- All CI/CD pipeline and structural formatting tasks have been fully satisfied. Future engineers can expand the Jest coverage or build out UI tests using Cypress/Playwright if desired.
