#!/bin/bash

# Wait for X server
sleep 5

# Start Chromium in kiosk mode
chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --enable-features=OverlayScrollbar --start-fullscreen http://localhost:3000 &

# Start unclutter to hide mouse cursor
unclutter -idle 0.1 &
