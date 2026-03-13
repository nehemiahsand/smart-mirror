# Security Hardening Summary

Date: 2026-03-13

## Completed in this pass

### 1. Backend auth now fails closed

- Added startup validation in `backend/src/index.js`.
- Backend now refuses weak or missing values for:
  - `API_KEY`
  - `ADMIN_PASSWORD`
  - `AUTH_SECRET`
- Removed insecure fallback behavior from:
  - `backend/src/middleware/apiKey.js`
  - `backend/src/middleware/adminAuth.js`
  - `backend/src/utils/auth.js`

### 2. Removed browser API-key model

- Removed `VITE_API_KEY` usage from:
  - `mobile-pwa/src/apiClient.js`
  - `mobile-pwa/src/pages/Camera.jsx`
  - `mobile-pwa/src/pages/Photos.jsx`
  - `display/src/apiClient.js`
  - `display/src/hooks/useWebSocket.js`
  - `display/src/widgets/Photos.jsx`
- Removed frontend API-key config from:
  - `docker-compose.yml`
  - `backend/Dockerfile`
- Deleted tracked frontend env files:
  - `mobile-pwa/.env`
  - `camera/.env`

### 3. Public write routes locked down

- Added `adminAuth` to state-changing public routes in:
  - `backend/src/api/routes.js`
  - `backend/src/api/layout-routes.js`
- Added scoped auth for Spotify control in:
  - `backend/src/api/spotify-routes.js`
  - `backend/src/middleware/adminOrApiKey.js`
- `/api/broadcast` is now internal-service-only via API key.

### 4. WebSocket reduced to read/broadcast behavior

- Removed client-issued state-changing command handling from:
  - `backend/src/api/websocket.js`
- Removed API-key requirement from browser WebSocket connections.
- Added page validation for `sync_page`.
- WebSocket settings payloads are now redacted.

### 5. Camera stream auth cleaned up

- Added short-lived scoped stream tokens in:
  - `backend/src/api/routes.js`
- Added dedicated stream auth middleware:
  - `backend/src/middleware/cameraStreamAuth.js`
- Camera feed no longer relies on generic query-string admin/API tokens.

### 6. WiFi shell injection risk reduced

- Reworked dangerous shell-interpolated SSID/password paths in:
  - `backend/src/services/wifi.js`
- Added:
  - input validation
  - `execFile`-based command execution
  - escaped WPA config generation
  - direct file writes instead of shell `echo | tee`

### 7. Secret/build hygiene improved

- Added root `.gitignore` entries for local env files.
- Expanded `.dockerignore` to exclude secret files from image build context.
- Removed stale built PWA files that contained old secret-bearing bundles.
- Rotated local values in `backend/.env` for:
  - `API_KEY`
  - `ADMIN_PASSWORD`
  - `AUTH_SECRET`

### 8. Admin auth moved out of localStorage

- Replaced browser-managed bearer token storage with an `HttpOnly` admin session cookie.
- Added cookie/session helpers in:
  - `backend/src/utils/requestAuth.js`
- Added auth session endpoints in:
  - `backend/src/api/routes.js`
- Updated the PWA to use server-side session checks instead of reading a token from browser storage:
  - `mobile-pwa/src/App.jsx`
  - `mobile-pwa/src/apiClient.js`
  - `mobile-pwa/src/pages/Login.jsx`
  - `mobile-pwa/src/pages/Settings.jsx`

### 9. Login throttling added

- Added in-memory login rate limiting and timed lockout in:
  - `backend/src/utils/loginRateLimit.js`
  - `backend/src/api/routes.js`
- `/api/auth/login` now:
  - limits repeated failed attempts per IP
  - returns `429` with `Retry-After` during lockout
  - clears the failure window on successful login

### 10. OAuth state validation added

- Added one-time OAuth state issuance/consumption in:
  - `backend/src/utils/oauthState.js`
- Spotify auth URL generation and callback validation now require a valid `state`:
  - `backend/src/api/spotify-routes.js`
  - `backend/src/services/spotify.js`
- Google Calendar auth URL generation and authorization now require a valid `state`:
  - `backend/src/api/routes.js`
  - `backend/src/services/googleCalendar.js`
- The standalone calendar authorization helper now validates returned state too:
  - `backend/authorize-calendar.js`

### 11. Container privileges reduced

- Removed `privileged: true` from all services except the sensor sidecar in `docker-compose.yml`.
- Removed `network_mode: host` and switched to normal Compose networking.
- Added narrower container constraints where practical:
  - `cap_drop: [ALL]`
  - `security_opt: no-new-privileges:true`
  - `read_only: true` and `tmpfs: /tmp` on the smaller Python sidecars
- Moved internal service traffic onto the Compose network and updated URLs:
  - backend now talks to `sensor:5555` and `camera:5556`
  - voice now talks to `backend:3001`
- Exposed only the host-facing ports that still need to be reachable:
  - backend `80 -> 3001`
  - display `3000 -> 3000`
- Updated internal bind addresses so sensor/camera are reachable without host networking:
  - `sensor/dht22_server.py`
  - `camera/camera_service.py`

### 12. Runtime validation and follow-up fixes

- Rebuilt the Docker stack with the tightened Compose config and smoke-tested the live services.
- Fixed backend sensor service discovery to honor `SENSOR_URL` in:
  - `backend/src/sensors/dht22.js`
- Fixed backend runtime config loading under Compose by explicitly loading the backend env file in:
  - `docker-compose.yml`
- Fixed backend bind-mount permissions by running the backend as the host `smartmirror` user:
  - `docker-compose.yml`
- Kept the sensor service on bridged networking, but initially restored the minimum rollback required for hardware access:
  - `privileged: true` remained on `sensor`
  - `read_only: true` was removed from `sensor` because the GPIO stack needs to create runtime notification files
- Removed `read_only: true` from `camera` because MediaPipe downloads its pose model into its package directory on first boot
- Verified live runtime behavior for:
  - backend health endpoint
  - sensor readings through `/api/sensor`
  - camera status through `/api/camera/status`
  - admin login/session/logout with `HttpOnly` cookie
  - authenticated Spotify and Google Calendar auth URL generation with OAuth `state`
  - voice reconnecting to backend WebSocket after backend startup

### 13. Camera root filesystem re-locked

- Baked the MediaPipe lite pose model into the camera image in:
  - `camera/Dockerfile`
- Set `MPLCONFIGDIR=/tmp/matplotlib` in the camera image to keep Matplotlib scratch data on writable tmpfs.
- Restored `read_only: true` for `camera` in:
  - `docker-compose.yml`
- Rebuilt and verified the live camera container with:
  - `ReadonlyRootfs=true`
  - no runtime MediaPipe model download
  - healthy `GET /api/camera/status` response through the backend

### 14. Sensor root filesystem re-locked

- Restored `read_only: true` for `sensor` in:
  - `docker-compose.yml`
- Moved the sensor container runtime working directory to writable tmpfs and ran the server script by absolute path:
  - `working_dir: /tmp`
  - `command: ["python3", "/app/dht22_server.py"]`
- Verified the live sensor container with:
  - `ReadonlyRootfs=true`
  - `WorkingDir=/tmp`
  - direct sensor-sidecar response from `http://sensor:5555`
- Result:
  - writable root filesystem is no longer required for `sensor`
  - at this stage, `privileged: true` still appeared to be required for hardware/platform access

### 15. Sensor `privileged` mode eliminated

- Identified the real cause of the sensor-side `privileged` requirement:
  - Adafruit Blinka and `rpi-lgpio` failed Raspberry Pi detection in an unprivileged container before GPIO access began
- Confirmed the container could run without `privileged` once the Pi identity was forced and the live GPIO lock was removed:
  - `BLINKA_FORCECHIP=BCM2XXX`
  - `BLINKA_FORCEBOARD=RASPBERRY_PI_5`
  - `RPI_LGPIO_REVISION=d04170`
- Updated `docker-compose.yml` to:
  - remove `privileged: true` from `sensor`
  - set the three Raspberry Pi detection overrides above
- Rebuilt and verified the live sensor service with:
  - `Privileged=false`
  - `ReadonlyRootfs=true`
  - healthy direct sidecar response from `http://sensor:5555`
  - healthy backend response from `GET /api/sensor`

### 16. Admin sessions moved to a standard JWT library with server-side revocation

- Replaced the custom HMAC-signed token format in:
  - `backend/src/utils/auth.js`
  - `backend/src/api/routes.js`
  - `backend/src/middleware/adminAuth.js`
  - `backend/src/middleware/adminOrApiKey.js`
  - `backend/src/middleware/cameraStreamAuth.js`
- Added `jsonwebtoken` as the signing/verification library in:
  - `backend/package.json`
- Added a server-side admin session registry in:
  - `backend/src/utils/adminSessions.js`
- Admin login now:
  - issues a JWT with standard `iss`, `iat`, `exp`, `aud`, `sub`, and `jti` claims
  - rotates the prior admin session on each new login
  - persists the active admin session ID so logout revokes the token server-side
- Camera stream tokens now:
  - use the same JWT library
  - carry a dedicated `camera-stream` audience
  - remain short-lived and scope-limited

### 17. Camera and voice now run as non-root

- Updated `docker-compose.yml` so:
  - `camera` runs as `1000:1000` with only the host `video` group added
  - `voice` runs as `1000:1000` with only the host `audio` group added
- Updated `voice/Dockerfile` so the non-root runtime keeps writable cache/home paths on tmpfs:
  - `HOME=/tmp`
  - `XDG_CACHE_HOME=/tmp/.cache`
- Rebuilt and verified the live containers with:
  - `Config.User="1000:1000"`
  - `GroupAdd=["44"]` for `camera`
  - `GroupAdd=["29"]` for `voice`
  - `ReadonlyRootfs=true` still intact for both

### 18. Focused security smoke test added

- Added a repeatable verification script in:
  - `scripts/security-smoke-test.sh`
- The script exercises:
  - admin login and cookie session acceptance
  - login lockout using a synthetic forwarded client IP
  - Spotify invalid OAuth state rejection
  - Google Calendar invalid OAuth state rejection
  - bridged-network voice-to-backend connectivity and audio device visibility
  - logout
- Added ignore rules for Python cache artifacts in:
  - `.gitignore`

### 19. Backend CORS fallback tightened

- Tightened origin validation in:
  - `backend/src/index.js`
- Removed the permissive fallback that trusted any origin on ports `80`, `443`, `3000`, or `3002`.
- Backend now only allows:
  - explicitly configured origins from `CORS_ALLOWED_ORIGINS`
  - loopback origins
  - private LAN IP origins
  - `.local`, `.localdomain`, and `.ts.net` hostnames on expected ports
- Rejected:
  - origins with embedded credentials
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

- `node --check` passed on modified backend files.
- `python3 -m py_compile` passed for:
  - `sensor/dht22_server.py`
  - `camera/camera_service.py`
  - `voice/voice_service.py`
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
  - rebuilt `camera` service with baked MediaPipe model
  - `docker inspect ... ReadonlyRootfs => true`
  - no runtime `Downloading model to ... pose_landmark_lite.tflite` log line after rebuild
- Sensor-specific follow-up verification passed for:
  - rebuilt `sensor` service with `ReadonlyRootfs => true`
  - `WorkingDir => /tmp`
  - direct `http://sensor:5555` response from the backend container network
- Final hardening verification passed for:
  - `./scripts/security-smoke-test.sh`
  - server-side admin session revocation (`GET /api/auth/session` changed from `200` before logout to `401` after logout using the same cookie jar)
  - camera raw stream access with a short-lived JWT stream token (`GET /api/camera/raw?streamToken=...` returned `200`)
  - `GET /api/power/status` returned `{"available":true,"tokenConfigured":true}` after the `dbus-send` migration
  - backend `npm audit --json` returned `0` vulnerabilities

## Still remaining

- Voice still emits ALSA/JACK noise on startup even though it becomes functional after reconnecting to backend.

## Next task note

- If desired, suppress the remaining ALSA/JACK noise during voice startup without regressing microphone capture.
- If desired, extend `scripts/security-smoke-test.sh` into CI or a systemd post-deploy check.

## Recommended next pass

1. Decide whether to suppress or quiet the remaining ALSA/JACK startup noise in `voice`.
2. If you want deployment enforcement, wire `scripts/security-smoke-test.sh` into your deploy flow.
