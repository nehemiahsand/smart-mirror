#!/bin/bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-/home/smartmirror/.Xauthority}"

MODE="${1:-}"
WINDOW_FILE="${XDG_RUNTIME_DIR:-/run/user/1000}/smart-mirror-browser-window"

case "${MODE}" in
  browse)
    ACTIVE_WINDOW="$(xdotool getactivewindow)"
    ACTIVE_TITLE="$(xdotool getwindowname "${ACTIVE_WINDOW}")"

    # Preserve Escape's normal behavior everywhere except the mirror tab.
    if [[ "${ACTIVE_TITLE}" != "Smart Mirror - Brave" ]]; then
      xdotool key --window "${ACTIVE_WINDOW}" --clearmodifiers Escape
      exit 0
    fi

    printf '%s\n' "${ACTIVE_WINDOW}" > "${WINDOW_FILE}"
    xdotool key --window "${ACTIVE_WINDOW}" --clearmodifiers F11
    sleep 0.25
    xdotool key --window "${ACTIVE_WINDOW}" --clearmodifiers ctrl+t
    ;;
  mirror)
    if [[ -r "${WINDOW_FILE}" ]]; then
      read -r BROWSER_WINDOW < "${WINDOW_FILE}"
    else
      BROWSER_WINDOWS="$(xdotool search --onlyvisible --class brave-browser)"
      read -r BROWSER_WINDOW <<< "${BROWSER_WINDOWS}"
    fi

    if [[ -z "${BROWSER_WINDOW:-}" ]]; then
      exit 1
    fi

    xdotool windowactivate --sync "${BROWSER_WINDOW}"
    xdotool key --window "${BROWSER_WINDOW}" --clearmodifiers ctrl+1
    sleep 0.25
    xdotool key --window "${BROWSER_WINDOW}" --clearmodifiers F11
    ;;
  *)
    echo "Usage: $0 {browse|mirror}" >&2
    exit 2
    ;;
esac
