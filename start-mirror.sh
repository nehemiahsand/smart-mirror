#!/bin/bash
# Start all docker containers once
cd /home/smartmirror/Downloads/smart-mirror

echo "[start-mirror] Starting Smart Mirror services..."

# Disable WiFi power saving to keep Tailscale connected
echo "[start-mirror] Disabling WiFi power saving..."
sudo iw dev wlan0 set power_save off 2>/dev/null || true

# Ensure Tailscale is connected (no timeout, accept routes)
echo "[start-mirror] Ensuring Tailscale VPN is active..."
sudo tailscale up --timeout=0 --accept-routes 2>/dev/null || echo "[start-mirror] Tailscale already active"
echo "[start-mirror] Tailscale VPN: Active (access remotely via Tailscale IP)"

# Start Docker containers first (they need to be running for the web interface)
echo "[start-mirror] Starting Docker containers..."
sudo docker compose up -d
sleep 5

# One-time network check: if not connected to any known network, start hotspot
if ! ip addr show wlan0 | grep -q "inet " || ! ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1; then
  if command -v nmcli >/dev/null 2>&1; then
    echo "[start-mirror] Wi-Fi not connected. Starting open setup hotspot..."
    
    # Delete any existing Hotspot connection to ensure clean slate
    sudo nmcli connection delete Hotspot 2>/dev/null || true
    
    # Create and start truly open hotspot with NO security
    sudo nmcli connection add \
      type wifi \
      ifname wlan0 \
      con-name Hotspot \
      autoconnect no \
      ssid "SmartMirror-Setup" \
      mode ap \
      802-11-wireless.mode ap \
      802-11-wireless.band bg \
      ipv4.method shared \
      ipv4.addresses 10.42.0.1/24 2>/dev/null || true
    
    # Activate the hotspot
    sudo nmcli connection up Hotspot 2>/dev/null || true
    
    # Wait a moment for it to come up
    sleep 3
    
    echo "[start-mirror] Hotspot active. Connect to 'SmartMirror-Setup' and visit http://10.42.0.1:3000"
    echo "[start-mirror] Backend API available at http://10.42.0.1:3001"
  fi
else
  echo "[start-mirror] Already connected to WiFi, skipping hotspot setup"
fi

# Disable screen blanking
export DISPLAY=:0
xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

# Start Firefox in kiosk mode (only if not already running)
if ! pgrep -f "firefox.*localhost:3000" > /dev/null; then
  # Install unclutter if not present (hides cursor after inactivity)
  if ! command -v unclutter &> /dev/null; then
    sudo apt-get update && sudo apt-get install -y unclutter
  fi
  
  # Start unclutter to hide cursor after 1 second of inactivity
  unclutter -idle 1 -root &
  
  # Start Firefox in kiosk mode with minimal flags
  firefox \
    --kiosk \
    http://localhost:3000 &
  
  # Give firefox a moment to start, then move cursor to trigger auto-hide
  sleep 3
  xdotool mousemove 0 0
fi

# Keep script alive indefinitely
while true; do
  sleep 3600
done
