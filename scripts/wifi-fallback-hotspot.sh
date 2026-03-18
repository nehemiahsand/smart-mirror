#!/bin/bash
# WiFi Fallback Hotspot Script
# Automatically starts hotspot if no known WiFi networks are available

HOTSPOT_NAME="Hotspot"
WAIT_TIME=15  # Wait 15 seconds for WiFi to connect
CHECK_INTERVAL=5  # Check every 5 seconds

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    logger -t wifi-fallback "$1"
}

log "WiFi fallback hotspot service starting..."

# Wait for NetworkManager to be ready
sleep 5

# Wait up to WAIT_TIME seconds for a WiFi connection
log "Waiting up to ${WAIT_TIME} seconds for WiFi connection..."
elapsed=0
while [ $elapsed -lt $WAIT_TIME ]; do
    # Check if we have an active WiFi connection (not hotspot)
    active_wifi=$(nmcli -t -f TYPE,STATE connection show --active | grep "^802-11-wireless:activated$")
    
    if [ -n "$active_wifi" ]; then
        # Check if it's not the hotspot
        active_name=$(nmcli -t -f NAME,TYPE connection show --active | grep "802-11-wireless" | cut -d: -f1)
        if [ "$active_name" != "$HOTSPOT_NAME" ]; then
            log "WiFi connection found: $active_name - hotspot not needed"
            exit 0
        fi
    fi
    
    sleep $CHECK_INTERVAL
    elapsed=$((elapsed + CHECK_INTERVAL))
done

# No WiFi connection found, check one more time
active_wifi=$(nmcli -t -f TYPE,STATE connection show --active | grep "^802-11-wireless:activated$")
if [ -n "$active_wifi" ]; then
    active_name=$(nmcli -t -f NAME,TYPE connection show --active | grep "802-11-wireless" | cut -d: -f1)
    if [ "$active_name" != "$HOTSPOT_NAME" ]; then
        log "WiFi connected during final check: $active_name - hotspot not needed"
        exit 0
    fi
fi

# No WiFi connection - start hotspot
log "No WiFi connection found - starting fallback hotspot"

# Try to bring up existing hotspot connection
if nmcli connection up "$HOTSPOT_NAME" 2>/dev/null; then
    log "Hotspot '$HOTSPOT_NAME' started successfully"
else
    log "Failed to start hotspot '$HOTSPOT_NAME'"
    exit 1
fi

log "WiFi fallback hotspot service completed"
