# USB power with standby + camera preview (Raspberry Pi 5)

When the mirror **enters standby**, the backend writes `off` to
`backend/data/usb-power-state`. When it **wakes**, it writes `on`.

A systemd **path unit** watches that file and runs
`deploy/scripts/set-led-usb-power.sh`, which calls `uhubctl`.

## Raspberry Pi 5 behaviour

On Pi 5, **all four USB‑A sockets share one ganged VBUS switch**. Turning “off”
requires the sequence from the upstream `uhubctl` docs ([Raspberry Pi 5](https://github.com/mvp/uhubctl?tab=readme-ov-file#raspberry-pi-5)):

```bash
uhubctl -l 2 -a off
uhubctl -l 4 -a off
```

…and the matching pair of commands with `on` to restore power. That cuts power
to **everything** plugged into those ports at once (webcam + LED strip).

This repo defaults the host script to **ganged** mode (`USB_POWER_PI5_STRATEGY=ganged`).

## Desired product behaviour

1. **Enter standby:** all onboard USB ports powered off → LEDs dark, webcam unpowered.
2. **Open the Camera page in the PWA** (`/api/camera/raw` proxy): temporarily power **all**
   ports back on (same sequence as waking USB) → webcam works and LEDs come back on together.
3. **Close/stop the camera stream** (disconnect from `/api/camera/raw`): if still in standby,
   power **off** again.
4. **Exit standby:** power **on** again (handled by `sceneEngine.applyStandbyMode(false)`).

The backend tracks how many simultaneous `/api/camera/raw` clients are connected; USB is only turned
off when the **last** client disconnects while still in standby.

After USB is brought back, the backend waits **`USB_STANDBY_CAMERA_SETTLE_MS`**
milliseconds (default `2000`, compose sets `2500`) so the webcam can re-enumerate before
the MJPEG proxy connects to the camera container.

## One-time host setup

```bash
sudo apt install -y uhubctl

REPO=/home/smartmirror/Downloads/smart-mirror
sudo cp "$REPO/deploy/systemd/smart-mirror-usb-power.service" /etc/systemd/system/
sudo cp "$REPO/deploy/systemd/smart-mirror-usb-power.path"    /etc/systemd/system/
sudo chmod +x "$REPO/deploy/scripts/set-led-usb-power.sh"
sudo systemctl daemon-reload
sudo systemctl enable --now smart-mirror-usb-power.path
```

## Test it

```bash
echo off > backend/data/usb-power-state
journalctl -u smart-mirror-usb-power.service -n 30 --no-pager

echo on > backend/data/usb-power-state
journalctl -u smart-mirror-usb-power.service -n 30 --no-pager
```

### Optional

- **`exact` mode** (`USB_POWER_PI5_STRATEGY=exact`): tries to toggle only USB3 hubs with
  `--exact`. Often leaves VBUS up; dumb LED strips may stay lit. Not suitable for Pi 5 strip control.
