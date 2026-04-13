#!/bin/bash

# Wait for X server
sleep 5

# Start Brave in kiosk mode
/home/smartmirror/Downloads/smart-mirror/scripts/launch-kiosk-browser.sh http://localhost:3000 || exit 1

# Start unclutter to hide mouse cursor
if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 0.1 &
fi
