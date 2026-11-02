// Isolated browser/security-test server. Never import this module from production.
if (process.env.NODE_ENV !== 'test')
  throw new Error('The fixture server requires NODE_ENV=test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const preview = process.env.NEXUS_PREVIEW_CONFIG
  ? JSON.parse(fs.readFileSync(process.env.NEXUS_PREVIEW_CONFIG, 'utf8'))
  : null;
if (
  preview &&
  (!preview.password ||
    preview.password.length < 16 ||
    !preview.authSecret ||
    preview.authSecret.length < 32 ||
    !fs.existsSync(path.join(preview.publicDirectory, 'index.html')))
)
  throw new Error('Invalid isolated preview configuration');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-browser-'));
process.env.NEXUS_DATA_DIR = directory;
process.env.PHOTOS_DIR = path.join(directory, 'photos');
process.env.PHOTOS_THUMBNAILS_DIR = path.join(directory, 'photos-thumbnails');
process.env.ADMIN_PASSWORD = preview?.password || 'nexus-local-test-password';
process.env.AUTH_SECRET =
  preview?.authSecret || 'nexus-isolated-tests-only-not-for-deployment-123456';
process.env.API_KEY = 'nexus-isolated-test-api-key';
process.env.SPOTIFY_CLIENT_ID = 'fixture-client';
process.env.SPOTIFY_CLIENT_SECRET = 'fixture-secret';
fs.writeFileSync(
  path.join(directory, 'calendar-credentials.json'),
  JSON.stringify({
    installed: {
      client_id: 'fixture',
      client_secret: 'fixture',
      redirect_uris: ['http://127.0.0.1:4311/api/calendar/callback'],
    },
  }),
);
const express = require('express');
const app = express();
app.set('trust proxy', true);
app.use(
  require('cors')({ origin: 'http://127.0.0.1:4312', credentials: true }),
);
app.use(express.json());
// Network review must never scan or change the machine running this fixture.
const fixtureAdmin = require('../src/middleware/adminAuth');
app.get('/api/wifi/current', fixtureAdmin, (_, res) => res.json({
  ssid: 'Nexus test network', ip: '192.0.2.10', signal: 80, connected: true,
}));
app.get('/api/wifi/scan', fixtureAdmin, (_, res) => res.json({
  networks: [
    { ssid: 'Nexus test network', signal: 80, secured: true, security: 'WPA2' },
    { ssid: 'Guest test network', signal: 55, secured: false, security: 'Open' },
  ],
  count: 2,
}));
app.post('/api/wifi/connect', fixtureAdmin, (_, res) => res.status(501).json({
  success: false, error: 'Network changes are unavailable in the isolated preview.',
}));
const settings = require('../src/services/settings');
const clock = require('../src/services/clock');
const lights = require('../src/services/lights');
const devices = require('../src/services/devices');
const configuration = require('../src/services/nexusConfig');
const consoleService = require('../src/services/console');
const scene = require('../src/services/sceneEngine');
const websocket = require('../src/api/websocket');
let currentPage = 0;
const pages = ['Main', 'Weather', 'Sports', 'Spotify'];
consoleService.getState = () => ({
  standby: !!settings.get('display.standbyMode'),
  pageTitle: pages[currentPage],
  activePageId: ['home', 'weather', 'sports', 'spotify'][currentPage],
  softButtons: settings.get('display.standbyMode')
    ? { button1: 'Wake' }
    : [
        {
          button1: 'Weather',
          button2: 'Prev',
          button3: 'Next',
          button4: 'Default',
        },
        { button1: 'Sports', button2: '', button3: '', button4: 'Refresh' },
        {
          button1: 'Spotify',
          button2: 'Prev',
          button3: 'Next',
          button4: 'Box',
        },
        { button1: 'Main', button2: 'Prev', button3: 'Next', button4: 'Play' },
      ][currentPage],
});
consoleService.handleSettingsChanged = async () => {};
scene.handleSettingsChanged = async () => {};
scene.applyStandbyMode = async (enabled) => {
  await settings.update('display.standbyMode', enabled);
  websocket.broadcastConsoleState(consoleService.getState());
};
scene.handleEsp32Event = async (event) => {
  if (event.type === 'display.page.toggle') {
    if (settings.get('display.standbyMode'))
      await scene.applyStandbyMode(false);
    else currentPage = (currentPage + 1) % pages.length;
  }
  websocket.broadcastConsoleState(consoleService.getState());
};
require('../src/services/weather').getCurrentWeather = async () => ({
  error: 'fixture_weather_disabled',
});
require('../src/services/climate').recordEsp32Reading(
  { temperatureCelsius: 22, humidity: 43 },
  { deviceId: 'mirror-entry-1' },
);
let captureEnabled = true;
require('../src/services/camera').setCameraEnabled = async (enabled) => {
  captureEnabled = enabled;
};
app.get('/api/camera/status', (_, res) =>
  res.json({
    enabled: captureEnabled,
    stream_resolution: preview ? { width: 1280, height: 720 } : { width: 640, height: 480 },
  }),
);
app.get(
  '/api/camera/raw',
  require('../src/middleware/cameraStreamAuth'),
  (_, res) => {
    const illustration = path.join(__dirname, '../../docs/design-concepts/relay-refinement/assets/room.svg');
    if (preview && fs.existsSync(illustration)) return res.type('image/svg+xml').send(fs.readFileSync(illustration));
    return res
      .type('image/png')
      .send(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
          'base64',
        ),
      );
  },
);
clock.connected = true;
clock.online = true;
clock.fresh = true;
clock.updatedAt = Date.now();
clock.state = {
  apiVersion: 2,
  deviceId: 'smart-clock',
  masterEnabled: true,
  sharpAlarmGateEnabled: true,
  sharpAlarmOutputEnabled: true,
  controlMode: 'smart',
  timeValid: true,
  timeStatus: 'synchronized',
  epoch: Math.floor(Date.now() / 1000),
  wifiConnected: true,
  mqttConnected: true,
  sharpBusy: false,
  ringing: false,
  ringingInferred: true,
  alarms: [],
  timers: [],
};
clock.client = {
  end() {},
  publish(topic, data, options, callback) {
    const command = JSON.parse(data);
    callback();
    setTimeout(() => {
      const state = structuredClone(clock.state);
      state.epoch = Math.floor(Date.now() / 1000);
      if (command.action === 'master.set')
        state.masterEnabled = command.enabled;
      if (command.action === 'sharp_alarm.set_enabled') {
        state.sharpAlarmGateEnabled = command.enabled;
        state.sharpAlarmOutputEnabled = command.enabled;
      }
      if (command.action === 'alarm.upsert') {
        const alarm = {
          ...command,
          id: command.id || Date.now() % 1000000000,
          state: state.masterEnabled ? 'scheduled' : 'suspended',
          origin: 'pwa',
          temporary: false,
          epoch: command.epoch || 0,
          weekdayMask: command.weekdayMask || 0,
        };
        state.alarms = [
          ...state.alarms.filter((a) => a.id !== alarm.id),
          alarm,
        ];
      }
      if (command.action === 'alarm.set_enabled')
        state.alarms = state.alarms.map((a) =>
          a.id === command.id
            ? {
                ...a,
                enabled: command.enabled,
                state: command.enabled ? 'scheduled' : 'disabled',
              }
            : a,
        );
      if (command.action === 'alarm.delete')
        state.alarms = state.alarms.filter((a) => a.id !== command.id);
      if (command.action === 'timer.create')
        state.timers.push({
          id: Date.now() % 1000000000,
          targetEpoch: state.epoch + command.minutes * 60,
          enabled: true,
          pausedRemainingSeconds: command.minutes * 60,
          state: state.masterEnabled ? 'scheduled' : 'suspended',
        });
      if (command.action === 'timer.delete')
        state.timers = state.timers.filter((t) => t.id !== command.id);
      if (command.action === 'timer.set_enabled')
        state.timers = state.timers.map((t) =>
          t.id === command.id ? { ...t, enabled: command.enabled } : t,
        );
      if (command.action === 'alarm.dismiss') state.ringing = false;
      clock.receive(
        'smartmirror/esp32/smart-clock/state',
        Buffer.from(JSON.stringify(state)),
      );
      clock.receive(
        'smartmirror/esp32/smart-clock/response',
        Buffer.from(JSON.stringify({ requestId: command.requestId, ok: true })),
      );
    }, 20);
  },
};
const defaultConfig = structuredClone(configuration.DEFAULT_CONFIG);
defaultConfig.devices
  .filter((d) => d.kind === 'wled')
  .forEach((device, i) => {
    device.address = `http://192.168.50.${50 + i}`;
    device.favorites = [{ name: 'Fixture preset', presetId: 1 }];
    lights.states.set(device.id, {
      online: true,
      updatedAt: Date.now(),
      state: {
        on: true,
        bri: 128,
        ps: 1,
        seg: [{ id: 0, start: 0, stop: 20, col: [[50, 180, 170, 0]] }],
      },
      info: { ver: 'test-only', uptime: 120 },
      presets: { 1: { n: 'daytime', seg: [{ col: [[255, 214, 160]], fx: 0 }] }, 2: { n: 'Star Wars', seg: [{ col: [[0, 0, 255]], fx: 0 }, { col: [[255, 0, 0]], fx: 0 }] }, 3: { n: i ? 'gaming' : 'Rainbow (bright)', seg: [{ fx: 9 }] }, 4: { n: 'GSW', seg: [{ col: [[0, 0, 255]] }, { col: [[255, 199, 44]] }] }, 5: { n: 'AUBURN', seg: [{ col: [[0, 0, 255]] }, { col: [[232, 119, 34]] }] }, 6: { n: i ? 'soft night' : 'Rainbow', seg: [{ col: [[255, 214, 160]], fx: i ? 0 : 9 }] } },
    });
  });
configuration.save(defaultConfig);
lights.seedPairs();
const sportsExperience = require('../src/services/sportsExperience');
sportsExperience.live = async () => ({ games: [], failures: [], checkedAt: Date.now() });
sportsExperience.getHighlights = async () => ({ items: [], unavailable: true, message: 'Highlights are simulated in this isolated preview.' });
consoleService.broadcastPageData = async () => {};
require('../src/services/activity').record('desk', 'Preset applied');
require('../src/services/activity').record('monitor', 'Connection interrupted', 'warning');
require('../src/services/activity').record('monitor', 'Lighting command failed', 'error');
// All outbound WLED I/O is replaced; requests never leave this process.
lights.request = async (device, url, body) => {
  const old = lights.states.get(device.id);
  return {
    ...old.state,
    on: body?.on ?? old.state.on,
    bri: body?.bri ?? old.state.bri,
    ps: body?.ps ?? old.state.ps,
    seg: old.state.seg.map((segment) => ({
      ...segment,
      ...(body?.seg?.find((update) => update.id === segment.id) || {}),
    })),
  };
};
lights.reconfigure = () => {};
devices.records.set('mirror', {
  online: true,
  lastSeen: Date.now(),
  capabilities: [],
  measurements: { cpuPercent: 12, memoryPercent: 38, diskPercent: 24 },
});
if (preview) {
  // A reviewed allowlist prevents legacy power/network/OAuth routes from running
  // host operations or reaching external services in the interactive preview.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const allowed =
      /^\/(?:auth\/(?:login|session|logout|stream-token)|health|console\/(?:state|button)|settings(?:\/[^/]+)?|sensor(?:\/status)?|photos(?:\/[^/]+(?:\/[^/]+)?)?|clock\/(?:state|history|command)|lights(?:\/[^/]+(?:\/command)?)?|devices|activity|nexus\/(?:config|preferences)|display\/standby|config\/(?:export|import)|privacy(?:\/status)?|sports(?:\/(?:teams|experience|selection))?)$/;
    if (allowed.test(req.path)) return next();
    return res
      .status(501)
      .json({
        error:
          'Unavailable in preview: no real device or external service is connected.',
      });
  });
}
app.use('/api', require('../src/api/routes'));
app.use('/api/spotify', require('../src/api/spotify-routes'));
if (preview) {
  app.use(express.static(preview.publicDirectory, { maxAge: 0 }));
  app.get('*', (_, res) =>
    res.sendFile(path.join(preview.publicDirectory, 'index.html')),
  );
}
const server = http.createServer(app);
websocket.initialize(server);
const heartbeat = preview
  ? setInterval(() => {
      clock.updatedAt = Date.now();
      clock.state.epoch = Math.floor(Date.now() / 1000);
      const record = devices.records.get('mirror');
      record.lastSeen = Date.now();
      for (const light of lights.states.values()) light.updatedAt = Date.now();
      require('../src/services/climate').recordEsp32Reading(
        { temperatureCelsius: 22, humidity: 43 },
        { deviceId: 'mirror-entry-1' },
      );
    }, 15000)
  : null;
settings
  .initialize()
  .then(() =>
    server.listen(preview ? 4313 : 4311, '127.0.0.1', () =>
      console.log(
        `Isolated Nexus ${preview ? 'preview' : 'fixtures'} listening on ${preview ? 4313 : 4311}`,
      ),
    ),
  );
function close() {
  clearInterval(heartbeat);
  websocket.close();
  server.close(() => {
    fs.rmSync(directory, { recursive: true, force: true });
    process.exit(0);
  });
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
