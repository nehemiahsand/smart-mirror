const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
jest.mock('../src/services/activity', () => ({
  list: jest.fn(() => []),
  record: jest.fn(),
}));
jest.mock('../src/utils/adminSessions', () => ({
  verifyAdminSessionToken: jest.fn((token) =>
    token === 'valid' ? { role: 'admin' } : null,
  ),
}));
jest.mock('../src/services/settings', () => ({
  get: jest.fn(),
  getAll: jest.fn(() => ({})),
  updateMultiple: jest.fn(async () => ({})),
}));
jest.mock('../src/services/sceneEngine', () => ({
  handleEsp32Event: jest.fn(async () => ({})),
  applyStandbyMode: jest.fn(async () => ({})),
}));
jest.mock('../src/services/console', () => ({
  getState: jest.fn(() => ({
    activePageId: 'weather',
    softButtons: {
      button1: 'Sports',
      button2: '',
      button3: '',
      button4: 'Refresh',
    },
  })),
  handleSettingsChanged: jest.fn(async () => {}),
  broadcastState: jest.fn(),
  broadcastPageData: jest.fn(async () => ({})),
}));
const router = require('../src/api/nexus-routes');
const {
  validateConfig,
  DEFAULT_CONFIG,
} = require('../src/services/nexusConfig');
const { cleanTelemetry } = require('../src/services/devices');
const { isPrivateAddress } = require('../src/utils/privateNetwork');
const mqttConfig = require('../src/utils/mqttConfig');
const scene = require('../src/services/sceneEngine');
const app = express();
app.use(express.json());
app.use('/api', router);
describe('Nexus API boundaries', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'configured';
    jest.clearAllMocks();
  });
  it.each([
    '/clock/state',
    '/clock/history',
    '/lights',
    '/devices',
    '/activity',
    '/sports/experience',
    '/nexus/config',
    '/config/export',
  ])('requires an admin session for %s', async (endpoint) => {
    await request(app).get(`/api${endpoint}`).expect(401);
  });
  it('blocks destructive actions without confirmation', async () => {
    await request(app)
      .post('/api/devices/mac/actions')
      .set('Authorization', 'Bearer valid')
      .send({ action: 'reboot' })
      .expect(400);
  });
  it('rejects unsupported Weather buttons and ignores no holds', async () => {
    await request(app)
      .post('/api/console/button')
      .set('Authorization', 'Bearer valid')
      .send({ buttonId: 'button2' })
      .expect(409);
    await request(app)
      .post('/api/console/button')
      .set('Authorization', 'Bearer valid')
      .send({ buttonId: 'button1', hold: true })
      .expect(400);
    await request(app)
      .post('/api/console/button')
      .set('Authorization', 'Bearer valid')
      .send({ buttonId: 'button4' })
      .expect(200);
    expect(scene.handleEsp32Event).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ui.action',
        payload: expect.objectContaining({ action: 'next', hold: false }),
      }),
    );
  });
  it('requires authentication and rejects invalid sports overrides', async () => {
    await request(app).post('/api/sports/selection').send({ mode: 'auto' }).expect(401);
    await request(app).post('/api/sports/selection').set('Authorization', 'Bearer valid').send({ mode: 'unsafe' }).expect(400);
    await request(app).post('/api/sports/selection').set('Authorization', 'Bearer valid').send({ mode: 'game' }).expect(400);
  });
  it('acknowledges a sports selection without waiting for the highlight provider', async () => {
    const sports = require('../src/services/sportsExperience');
    const consoleService = require('../src/services/console');
    const selection = jest.spyOn(sports, 'select').mockResolvedValue();
    const snapshot = jest.spyOn(sports, 'getExperience').mockResolvedValue({ games: [], mode: 'highlights' });
    consoleService.broadcastPageData.mockReturnValueOnce(new Promise(() => {}));
    try {
      const response = await request(app).post('/api/sports/selection').set('Authorization', 'Bearer valid').send({ mode: 'highlights' }).expect(200);
      expect(response.body.mode).toBe('highlights');
      expect(selection).toHaveBeenCalledWith({ mode: 'highlights' });
      expect(consoleService.broadcastState).toHaveBeenCalled();
    } finally { selection.mockRestore(); snapshot.mockRestore(); }
  });
  it('uses the same scene standby behavior with a strict boolean', async () => {
    await request(app)
      .post('/api/display/standby')
      .set('Authorization', 'Bearer valid')
      .send({ enabled: 'yes' })
      .expect(400);
    await request(app)
      .post('/api/display/standby')
      .set('Authorization', 'Bearer valid')
      .send({ enabled: true })
      .expect(200);
    expect(scene.applyStandbyMode).toHaveBeenCalledWith(true, 'nexus:standby');
  });
  it('rejects secrets, unknown fields and unsafe URLs from imports', () => {
    expect(() =>
      validateConfig({ ...DEFAULT_CONFIG, password: 'secret' }),
    ).toThrow();
    expect(() =>
      validateConfig({
        ...DEFAULT_CONFIG,
        devices: [
          {
            id: 'desk',
            name: 'Desk',
            kind: 'wled',
            address: 'file:///etc/passwd',
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      router.validSettings({ 'spotify.accessToken': 'secret' }),
    ).toThrow();
    expect(() =>
      router.validSettings({ pageVisibility: { home: { unknown: true } } }),
    ).toThrow();
    expect(() => router.validSettings({ pageVisibility: { weather: { hourly: false } }, 'sports.highlightsTeam': 'auburn', 'sports.liveGames': true, 'sports.livePriority': ['auburn', 'gsw'] })).not.toThrow();
    expect(() => router.validSettings({ 'sports.highlightsTeam': 'unknown' })).toThrow();
    expect(() => router.validSettings({ 'sports.livePriority': ['auburn', 'auburn'] })).toThrow();
    expect(() => router.validSettings({ 'sports.highlightsTeam': 'broncos' })).toThrow();
    expect(() => router.validSettings({ 'sports.livePriority': ['auburn', 'gsw', 'broncos'] })).toThrow();
  });
  it('previews imports without mutating settings', async () => {
    await request(app)
      .post('/api/config/import')
      .set('Authorization', 'Bearer valid')
      .send({
        document: {
          version: 1,
          config: DEFAULT_CONFIG,
          settings: { 'weather.city': 'Chicago,US' },
        },
      })
      .expect(200);
    expect(
      require('../src/services/settings').updateMultiple,
    ).not.toHaveBeenCalled();
  });
  it('keeps only bounded typed telemetry and rejects bogus utilization', () => {
    expect(cleanTelemetry({ cpuPercent: 12, password: 'hidden' })).toEqual({
      cpuPercent: 12,
    });
    expect(() => cleanTelemetry({ cpuPercent: 101 })).toThrow();
    expect(() =>
      cleanTelemetry({ services: { web: 'arbitrary shell output' } }),
    ).toThrow();
  });
  it('allows LAN/tailnet addresses and rejects loopback, link-local and public targets', () => {
    expect(isPrivateAddress('192.168.1.20')).toBe(true);
    expect(isPrivateAddress('100.101.1.2')).toBe(true);
    for (const address of [
      '127.0.0.1',
      '169.254.169.254',
      '8.8.8.8',
      '::1',
      '::ffff:127.0.0.1',
    ])
      expect(isPrivateAddress(address)).toBe(false);
  });
  it('requires TLS/CA/password and leaves hostname validation enabled', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-ca-'));
    const ca = path.join(dir, 'ca.pem');
    fs.writeFileSync(ca, 'test-ca');
    const env = {
      MQTT_BROKER_URL: 'mqtts://mosquitto:8883',
      MQTT_CA_FILE: ca,
      MQTT_USERNAME: 'backend',
      MQTT_PASSWORD: 'test',
    };
    expect(mqttConfig(env).options.rejectUnauthorized).toBe(true);
    expect(() =>
      mqttConfig({ ...env, MQTT_BROKER_URL: 'mqtt://mosquitto:1883' }),
    ).toThrow('mqtt_tls_required');
    expect(() => mqttConfig({ ...env, MQTT_CA_FILE: '' })).toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
