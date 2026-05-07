const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * USB power state service.
 *
 * The backend container runs unprivileged and cannot directly toggle USB
 * power. Instead, this service writes the desired USB 3 state to a file that a
 * host-side systemd path unit watches. The host then runs `uhubctl` (Pi 5:
 * use ganged mode — all four logical ports share one VBUS switch; see
 * deploy/systemd/README-usb-power.md).
 *
 * See deploy/systemd/smart-mirror-usb-power.{path,service} and
 * deploy/scripts/set-led-usb-power.sh for the host-side glue.
 */

const STATE_PATH =
  process.env.USB_POWER_STATE_PATH || '/app/data/usb-power-state';

async function setPowerState(enabled, reason = 'manual') {
  const state = enabled ? 'on' : 'off';
  const now = Date.now();

  try {
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
    await fs.writeFile(STATE_PATH, `${state} ${now} ${reason}\n`);
    logger.info('USB power state requested', { state, reason, path: STATE_PATH });
    return { success: true, state };
  } catch (error) {
    logger.error('Failed to write USB power state', {
      error: error.message,
      path: STATE_PATH,
      state,
    });
    return { success: false, error: error.message, state };
  }
}

module.exports = { setPowerState };
