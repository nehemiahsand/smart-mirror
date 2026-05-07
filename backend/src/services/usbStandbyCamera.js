const logger = require('../utils/logger');
const settingsService = require('./settings');

/** @type {number} */
let rawStreamRefCount = 0;

function isStandby() {
  return settingsService.get('display.standbyMode') === true;
}

function settleMs() {
  const n = Number.parseInt(process.env.USB_STANDBY_CAMERA_SETTLE_MS || '2000', 10);
  return Number.isFinite(n) && n >= 0 ? n : 2000;
}

/**
 * After VBUS is restored, the webcam and camera container need time to re-enumerate.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call when entering standby: USB power cut drops all streams; refcount must not leak.
 */
function resetForStandbyEntered() {
  rawStreamRefCount = 0;
}

/**
 * Before proxying /api/camera/raw while the mirror is in standby: turn all Pi USB on (ganged).
 */
async function acquireForRawStream() {
  if (!isStandby()) {
    return;
  }
  rawStreamRefCount += 1;
  if (rawStreamRefCount !== 1) {
    return;
  }

  const usbPower = require('./usbPower');
  await usbPower.setPowerState(true, 'standby:camera_raw_open');
  const ms = settleMs();
  if (ms > 0) {
    logger.info('USB standby camera: waiting for device settle', { ms });
    await sleep(ms);
  }
}

/**
 * After an /api/camera/raw client disconnects: if still in standby and no other clients, USB off.
 */
async function releaseForRawStream() {
  if (rawStreamRefCount <= 0) {
    rawStreamRefCount = 0;
    return;
  }
  rawStreamRefCount -= 1;
  if (rawStreamRefCount < 0) {
    rawStreamRefCount = 0;
  }
  if (!isStandby()) {
    return;
  }
  if (rawStreamRefCount > 0) {
    return;
  }

  const usbPower = require('./usbPower');
  await usbPower.setPowerState(false, 'standby:camera_raw_closed');
}

module.exports = {
  resetForStandbyEntered,
  acquireForRawStream,
  releaseForRawStream,
};
