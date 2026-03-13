#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost}"
COOKIE_JAR="$(mktemp)"
TMP_DIR="$(mktemp -d)"
LOCKOUT_IP="198.51.100.42"

cleanup() {
  rm -f "$COOKIE_JAR"
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "PASS: $*"
}

ADMIN_PASSWORD="$(
  cd "$ROOT_DIR/backend" &&
  node -e "require('dotenv').config({ path: '.env' }); process.stdout.write(process.env.ADMIN_PASSWORD || '')"
)"

if [[ -z "$ADMIN_PASSWORD" ]]; then
  fail "ADMIN_PASSWORD is not configured in backend/.env"
fi

LOGIN_BODY_FILE="$TMP_DIR/login-body.json"
LOGIN_STATUS="$(
  curl -sS \
    -c "$COOKIE_JAR" \
    -o "$LOGIN_BODY_FILE" \
    -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d "$(printf '{"password":"%s"}' "$ADMIN_PASSWORD")" \
    "$BASE_URL/api/auth/login"
)"
[[ "$LOGIN_STATUS" == "200" ]] || fail "Admin login returned HTTP $LOGIN_STATUS"
pass "Admin login succeeded"

SESSION_STATUS="$(
  curl -sS \
    -b "$COOKIE_JAR" \
    -o "$TMP_DIR/session-body.json" \
    -w '%{http_code}' \
    "$BASE_URL/api/auth/session"
)"
[[ "$SESSION_STATUS" == "200" ]] || fail "Session check returned HTTP $SESSION_STATUS"
pass "Admin session cookie is accepted"

for attempt in 1 2 3 4; do
  STATUS="$(
    curl -sS \
      -o /dev/null \
      -w '%{http_code}' \
      -H "X-Forwarded-For: $LOCKOUT_IP" \
      -H 'Content-Type: application/json' \
      -d '{"password":"wrong-password"}' \
      "$BASE_URL/api/auth/login"
  )"
  [[ "$STATUS" == "401" ]] || fail "Expected HTTP 401 for failed login attempt $attempt, got $STATUS"
done

STATUS="$(
  curl -sS \
    -o "$TMP_DIR/lockout-body.json" \
    -w '%{http_code}' \
    -H "X-Forwarded-For: $LOCKOUT_IP" \
    -H 'Content-Type: application/json' \
    -d '{"password":"wrong-password"}' \
    "$BASE_URL/api/auth/login"
)"
[[ "$STATUS" == "429" ]] || fail "Expected HTTP 429 for lockout attempt, got $STATUS"
pass "Login rate limiting locks out repeated failures"

SPOTIFY_STATE="$(
  curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/spotify/auth-url" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"])'
)"
[[ -n "$SPOTIFY_STATE" ]] || fail "Spotify auth URL did not return a state"

SPOTIFY_HEADERS="$TMP_DIR/spotify-callback.headers"
SPOTIFY_STATUS="$(
  curl -sS \
    -o /dev/null \
    -D "$SPOTIFY_HEADERS" \
    -w '%{http_code}' \
    "$BASE_URL/api/spotify/callback?code=fake-code&state=invalid-state"
)"
[[ "$SPOTIFY_STATUS" == "302" ]] || fail "Spotify callback invalid-state test returned HTTP $SPOTIFY_STATUS"
grep -qi 'location: /settings?spotify=error&reason=invalid_state' "$SPOTIFY_HEADERS" \
  || fail "Spotify callback did not redirect with invalid_state"
pass "Spotify callback rejects invalid OAuth state"

GOOGLE_STATE="$(
  curl -sS -b "$COOKIE_JAR" "$BASE_URL/api/calendar/auth-url" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"])'
)"
[[ -n "$GOOGLE_STATE" ]] || fail "Google Calendar auth URL did not return a state"

GOOGLE_BODY_FILE="$TMP_DIR/google-authorize.json"
GOOGLE_STATUS="$(
  curl -sS \
    -b "$COOKIE_JAR" \
    -o "$GOOGLE_BODY_FILE" \
    -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d '{"code":"fake-code","state":"invalid-state"}' \
    "$BASE_URL/api/calendar/authorize"
)"
[[ "$GOOGLE_STATUS" == "400" ]] || fail "Google Calendar invalid-state test returned HTTP $GOOGLE_STATUS"
grep -q 'INVALID_OAUTH_STATE' "$GOOGLE_BODY_FILE" \
  || fail "Google Calendar authorize response did not contain INVALID_OAUTH_STATE"
pass "Google Calendar authorize rejects invalid OAuth state"

VOICE_CHECK_OUTPUT="$TMP_DIR/voice-check.txt"
docker compose exec -T voice python3 - <<'PY' > "$VOICE_CHECK_OUTPUT"
import json
import os
import requests
import pyaudio

p = pyaudio.PyAudio()
try:
    payload = {
        "backend_health": requests.get("http://backend:3001/api/health", timeout=3).status_code,
        "audio_device_count": p.get_device_count(),
        "has_snd_device": os.path.exists("/dev/snd"),
        "can_rw_default_control": os.access("/dev/snd/controlC0", os.R_OK | os.W_OK) if os.path.exists("/dev/snd/controlC0") else False,
    }
finally:
    p.terminate()

print(json.dumps(payload))

if payload["backend_health"] != 200:
    raise SystemExit(1)
if not payload["has_snd_device"]:
    raise SystemExit(1)
if payload["audio_device_count"] <= 0:
    raise SystemExit(1)
PY
pass "Voice container can reach the backend and sees audio devices"

LOGOUT_STATUS="$(
  curl -sS \
    -b "$COOKIE_JAR" \
    -o /dev/null \
    -w '%{http_code}' \
    -X POST \
    "$BASE_URL/api/auth/logout"
)"
[[ "$LOGOUT_STATUS" == "200" ]] || fail "Logout returned HTTP $LOGOUT_STATUS"
pass "Logout succeeded"

echo
echo "Security smoke test output:"
cat "$VOICE_CHECK_OUTPUT"
