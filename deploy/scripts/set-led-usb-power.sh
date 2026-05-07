#!/bin/bash
# Set Pi 5 onboard USB VBUS for a dumb USB-powered LED strip tied to mirror standby.
#
# Reads backend/data/usb-power-state (first word: on|off), then runs uhubctl.
#
# Raspberry Pi 5 hardware limitation (see uhubctl README "Raspberry Pi 5"):
# all four USB-A ports share one ganged VBUS switch. VBUS only drops after every
# logical hub port in that group is powered off. That requires toggling USB3
# hubs 2 and 4 *without* --exact, which also powers down the companion USB2
# hubs — including the port used by a USB webcam. So you cannot keep the
# camera powered and cut VBUS to a strip on another onboard Pi USB port.
#
# Modes (set USB_POWER_PI5_STRATEGY in the systemd unit, or export before test):
#   ganged  (default) Official Pi 5 sequence: hubs 2+4 without --exact. Turns off
#           shared VBUS (LEDs + camera). Required for dumb USB LED strips.
#   exact   USB3 hubs 2 and 4 only with --exact. Often leaves VBUS up; strips stay lit.
#
# Requires: uhubctl (apt install uhubctl).

set -u

STATE_FILE="${USB_POWER_STATE_FILE:-/home/smartmirror/Downloads/smart-mirror/backend/data/usb-power-state}"
LOG_TAG="smart-mirror-usb-power"
# exact | ganged
PI5_STRATEGY="${USB_POWER_PI5_STRATEGY:-ganged}"

log() {
    logger -t "${LOG_TAG}" -- "$1"
    echo "[$(date -Iseconds)] $1"
}

if ! command -v uhubctl >/dev/null 2>&1; then
    log "ERROR: uhubctl not installed; install with: sudo apt install uhubctl"
    exit 1
fi

if [[ ! -f "${STATE_FILE}" ]]; then
    log "ERROR: state file not found: ${STATE_FILE}"
    exit 1
fi

read -r STATE _ < "${STATE_FILE}"
case "${STATE}" in
    on|off)
        ;;
    *)
        log "ERROR: invalid USB power state '${STATE}' in ${STATE_FILE}"
        exit 1
        ;;
esac

apply_exact_usb3_only() {
    local ok=0
    for hub in 2 4; do
        log "Pi5 exact: hub ${hub} ${STATE}"
        if uhubctl --exact -a "${STATE}" -l "${hub}" -p 1 >/dev/null 2>&1; then
            log "Set hub ${hub} port 1 ${STATE} OK (exact)"
            ok=1
        else
            log "uhubctl --exact hub ${hub} failed"
        fi
    done
    [[ "${ok}" -eq 1 ]]
}

apply_ganged_pi5() {
    # https://github.com/mvp/uhubctl?tab=readme-ov-file#raspberry-pi-5
    log "Pi5 ganged: hubs 2+4 ${STATE} (camera will lose USB power while off)"
    local ok=0
    if uhubctl -l 2 -a "${STATE}" >/dev/null 2>&1; then
        ok=1
    else
        log "uhubctl -l 2 -a ${STATE} failed"
    fi
    if uhubctl -l 4 -a "${STATE}" >/dev/null 2>&1; then
        ok=1
    else
        log "uhubctl -l 4 -a ${STATE} failed"
    fi
    [[ "${ok}" -eq 1 ]]
}

ANY_OK=0
case "${PI5_STRATEGY}" in
    exact)
        if apply_exact_usb3_only; then
            ANY_OK=1
        fi
        ;;
    ganged)
        if apply_ganged_pi5; then
            ANY_OK=1
        fi
        ;;
    *)
        log "ERROR: unknown USB_POWER_PI5_STRATEGY='${PI5_STRATEGY}' (use exact or ganged)"
        exit 1
        ;;
esac

if [[ "${ANY_OK}" -eq 0 ]]; then
    log "No uhubctl operation succeeded (strategy=${PI5_STRATEGY})"
    exit 2
fi

exit 0
