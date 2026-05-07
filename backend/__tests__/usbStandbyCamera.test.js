jest.mock('../src/services/settings', () => ({
  get: jest.fn(),
}));

jest.mock('../src/services/usbPower', () => ({
  setPowerState: jest.fn(async () => ({ success: true })),
}));

describe('usbStandbyCamera', () => {
  beforeEach(() => {
    process.env.USB_STANDBY_CAMERA_SETTLE_MS = '0';
    jest.resetModules();
    const settings = require('../src/services/settings');
    const usbPower = require('../src/services/usbPower');
    settings.get.mockReset();
    usbPower.setPowerState.mockReset();
    settings.get.mockImplementation((key) => {
      if (key === 'display.standbyMode') {
        return false;
      }
      return undefined;
    });
  });

  it('does not touch USB when not in standby', async () => {
    const usbStandbyCamera = require('../src/services/usbStandbyCamera');
    const usbPower = require('../src/services/usbPower');
    await usbStandbyCamera.acquireForRawStream();
    await usbStandbyCamera.releaseForRawStream();
    expect(usbPower.setPowerState).not.toHaveBeenCalled();
  });

  it('turns USB on for first raw stream in standby and off when last client closes', async () => {
    const settings = require('../src/services/settings');
    settings.get.mockImplementation((key) => key === 'display.standbyMode');

    const usbStandbyCamera = require('../src/services/usbStandbyCamera');
    const usbPower = require('../src/services/usbPower');

    await usbStandbyCamera.acquireForRawStream();
    await usbStandbyCamera.acquireForRawStream();
    expect(usbPower.setPowerState).toHaveBeenCalledTimes(1);
    expect(usbPower.setPowerState).toHaveBeenCalledWith(true, 'standby:camera_raw_open');

    await usbStandbyCamera.releaseForRawStream();
    expect(usbPower.setPowerState).toHaveBeenCalledTimes(1);

    await usbStandbyCamera.releaseForRawStream();
    expect(usbPower.setPowerState).toHaveBeenCalledTimes(2);
    expect(usbPower.setPowerState).toHaveBeenLastCalledWith(false, 'standby:camera_raw_closed');
  });

  it('does not turn USB off on release after leaving standby', async () => {
    const settings = require('../src/services/settings');
    settings.get.mockImplementation((key) => key === 'display.standbyMode');

    const usbStandbyCamera = require('../src/services/usbStandbyCamera');
    const usbPower = require('../src/services/usbPower');

    await usbStandbyCamera.acquireForRawStream();
    settings.get.mockImplementation(() => false);
    await usbStandbyCamera.releaseForRawStream();

    expect(usbPower.setPowerState).toHaveBeenCalledTimes(1);
    expect(usbPower.setPowerState).not.toHaveBeenCalledWith(false, expect.anything());
  });

  it('resetForStandbyEntered clears refcount so a new acquire asks for USB again', async () => {
    const settings = require('../src/services/settings');
    settings.get.mockImplementation((key) => key === 'display.standbyMode');

    const usbStandbyCamera = require('../src/services/usbStandbyCamera');
    const usbPower = require('../src/services/usbPower');

    await usbStandbyCamera.acquireForRawStream();
    usbStandbyCamera.resetForStandbyEntered();
    await usbStandbyCamera.acquireForRawStream();
    expect(usbPower.setPowerState.mock.calls.filter((c) => c[0] === true).length).toBe(2);
  });
});
