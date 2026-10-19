#!/bin/bash
set -euo pipefail

URL="${1:-http://localhost:3000}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"
export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-/home/smartmirror/.Xauthority}"
# Keep Brave off the system keyring — otherwise it pops "Authentication required / Unlock keyring".
export PASSWORD_STORE=basic
unset GNOME_KEYRING_CONTROL GNOME_KEYRING_PID SSH_AUTH_SOCK 2>/dev/null || true
KIOSK_PROFILE_DIR="/home/smartmirror/.config/brave-kiosk"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "${KIOSK_PROFILE_DIR}"

# Brave consumes Escape before page JavaScript can see it in browser fullscreen.
# Install compositor-level shortcuts so desktop switching remains reliable.
if [[ -x "${REPO_ROOT}/scripts/setup-browser-hotkeys.sh" ]]; then
  "${REPO_ROOT}/scripts/setup-browser-hotkeys.sh"
fi

# Best-effort policy install (suppresses Rewards / notification / promo UI)
if [[ -x "${REPO_ROOT}/scripts/setup-brave-kiosk-policies.sh" ]]; then
  "${REPO_ROOT}/scripts/setup-brave-kiosk-policies.sh" >/dev/null 2>&1 || true
fi

# Dismiss Brave in-product-help / onboarding prompts in the kiosk profile
python3 - <<'PY' "${KIOSK_PROFILE_DIR}/Default/Preferences" 2>/dev/null || true
import json, sys
from pathlib import Path

prefs_path = Path(sys.argv[1])
if not prefs_path.exists():
    sys.exit(0)

with prefs_path.open(encoding="utf-8") as f:
    prefs = json.load(f)

prefs.setdefault("browser", {})
prefs["browser"].setdefault("window_placement", {})

# Mark IPH / feature promos as dismissed so they do not overlay the mirror
iph = prefs.setdefault("in_product_help", {})
for key in list(iph.get("snoozed_feature", {}).keys()):
    feat = iph["snoozed_feature"][key]
    feat["is_dismissed"] = True
    feat["show_count"] = 0

# Brave Rewards off in profile (policy is authoritative; this is a backup)
brave = prefs.setdefault("brave", {})
brave.setdefault("rewards", {})["enabled"] = False

# Do not restore tabs after crash — the launcher always opens the mirror URL
prefs.setdefault("session", {})
prefs["session"]["restore_on_startup"] = 5

with prefs_path.open("w", encoding="utf-8") as f:
    json.dump(prefs, f, separators=(",", ":"))
PY

if command -v brave-browser >/dev/null 2>&1; then
  BROWSER_BIN="brave-browser"
elif command -v brave-browser-stable >/dev/null 2>&1; then
  BROWSER_BIN="brave-browser-stable"
else
  echo "[launch-kiosk-browser] Brave browser is required but was not found in PATH." >&2
  exit 1
fi

if pgrep -f "user-data-dir=${KIOSK_PROFILE_DIR}" >/dev/null 2>&1; then
  exit 0
fi

# Keep this list conservative — unknown feature names can crash Brave on ARM.
DISABLE_FEATURES="AutofillServerCommunication,TranslateUI,MediaRouter,PasswordLeakDetection"

"${BROWSER_BIN}" \
  --start-fullscreen \
  --no-first-run \
  --no-default-browser-check \
  --noerrdialogs \
  --disable-infobars \
  --disable-notifications \
  --disable-save-password-bubble \
  --disable-translate \
  --disable-session-crashed-bubble \
  --hide-crash-restore-bubble \
  --disable-restore-session-state \
  --disable-prompt-on-repost \
  --disable-component-update \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --disable-gpu \
  --use-gl=swiftshader \
  --password-store=basic \
  --use-mock-keyring \
  --disable-sync \
  --disable-features="${DISABLE_FEATURES}" \
  --user-data-dir="${KIOSK_PROFILE_DIR}" \
  --enable-features=OverlayScrollbar \
  "${URL}" &
