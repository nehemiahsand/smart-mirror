jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../src/services/settings', () => ({ get: jest.fn() }));
jest.mock('../src/utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
const axios = require('axios');
const settings = require('../src/services/settings');
const camera = require('../src/services/camera');
afterEach(() => { camera.stopMonitoring(); jest.clearAllMocks(); });
it.each([false, true])('restores saved camera privacy (%s) after backend/sidecar restart', async (enabled) => {
  settings.get.mockReturnValue(enabled);
  axios.get.mockResolvedValue({ data: { status: 'ok' } });
  axios.post.mockResolvedValue({ data: { success: true } });
  await camera.initialize();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining(enabled ? '/control/enable' : '/control/disable'), {}, { timeout: 3000 });
  expect(camera.cameraEnabled).toBe(enabled);
});
