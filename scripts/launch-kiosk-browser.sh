#!/bin/bash
set -euo pipefail

URL="${1:-http://localhost:3000}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"
export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-/home/smartmirror/.Xauthority}"
KIOSK_PROFILE_DIR="/home/smartmirror/.config/brave-kiosk"

mkdir -p "${KIOSK_PROFILE_DIR}"

if command -v brave-browser >/dev/null 2>&1; then
  BROWSER_BIN="brave-browser"
elif command -v brave-browser-stable >/dev/null 2>&1; then
  BROWSER_BIN="brave-browser-stable"
else
  echo "[launch-kiosk-browser] Brave browser is required but was not found in PATH." >&2
  exit 1
fi

if pgrep -f "brave.*${URL}" >/dev/null 2>&1; then
  exit 0
fi

"${BROWSER_BIN}" \
  --kiosk \
  --start-fullscreen \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --disable-gpu \
  --use-gl=swiftshader \
  --password-store=basic \
  --disable-sync \
  --disable-features=AutofillServerCommunication \
  --user-data-dir="${KIOSK_PROFILE_DIR}" \
  --enable-features=OverlayScrollbar \
  "${URL}" &
