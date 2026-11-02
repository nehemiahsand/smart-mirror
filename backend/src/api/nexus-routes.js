const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const config = require('../services/nexusConfig');
const clock = require('../services/clock');
const lights = require('../services/lights');
const devices = require('../services/devices');
const activity = require('../services/activity');
const sportsExperience = require('../services/sportsExperience');
const settings = require('../services/settings');
const consoleService = require('../services/console');
const sceneEngine = require('../services/sceneEngine');
const events = require('../services/nexusEvents');
const fail = require('../utils/serviceError');
const router = express.Router();
const wrap = (handler) => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await handler(req, res);
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ error: error.code || 'operation_failed' });
  }
};
const get = (path, handler) => router.get(path, adminAuth, wrap(handler));
const post = (path, handler) => router.post(path, adminAuth, wrap(handler));
const SETTINGS_KEYS = [
  'widgetOrder',
  'weatherWidgetOrder',
  'sportsWidgetOrder',
  'pageVisibility',
  'widgets',
  'weather.city',
  'weather.units',
  'sports.enabled',
  'sports.sport',
  'sports.defaultSport',
  'sports.teams',
  'sports.highlightsTeam',
  'sports.liveGames',
  'sports.livePriority',
  'photos.interval',
  'display.clockFormat',
];
const WIDGETS = {
  home: ['timedate', 'weathertemp', 'googlecalendar', 'photos'],
  weather: ['timedate', 'sunmoon', 'temps', 'hourly'],
  sports: ['timedate', 'highlights'],
};
function validSettings(values) {
  if (
    !values ||
    Array.isArray(values) ||
    typeof values !== 'object' ||
    Object.keys(values).some((key) => !SETTINGS_KEYS.includes(key))
  )
    throw fail('invalid_import_settings');
  for (const [key, value] of Object.entries(values)) {
    if (
      ['widgetOrder', 'weatherWidgetOrder', 'sportsWidgetOrder'].includes(key)
    ) {
      const page = {
        widgetOrder: 'home',
        weatherWidgetOrder: 'weather',
        sportsWidgetOrder: 'sports',
      }[key];
      if (
        !Array.isArray(value) ||
        new Set(value).size !== value.length ||
        value.some((id) => !WIDGETS[page].includes(id))
      )
        throw fail('invalid_widget_order');
    } else if (key === 'pageVisibility') {
      if (
        !value ||
        Array.isArray(value) ||
        typeof value !== 'object' ||
        Object.entries(value).some(
          ([page, widgets]) =>
            !Object.prototype.hasOwnProperty.call(WIDGETS, page) ||
            !widgets ||
            Array.isArray(widgets) ||
            typeof widgets !== 'object' ||
            Object.entries(widgets).some(
              ([id, enabled]) =>
                !WIDGETS[page].includes(id) || typeof enabled !== 'boolean',
            ),
        )
      )
        throw fail('invalid_visibility');
    } else if (key === 'widgets') {
      const allowed = [
        'clock',
        'date',
        'timedate',
        'weather',
        'calendar',
        'googlecalendar',
        'sports',
        'nba',
        'news',
        'traffic',
        'weathertemp',
        'photos',
      ];
      if (
        !value ||
        Array.isArray(value) ||
        typeof value !== 'object' ||
        Object.entries(value).some(
          ([name, enabled]) =>
            !allowed.includes(name) || typeof enabled !== 'boolean',
        )
      )
        throw fail('invalid_widgets');
    } else if (key === 'photos.interval') {
      if (!Number.isInteger(value) || value < 2 || value > 60)
        throw fail('invalid_photo_interval');
    } else if (key === 'sports.highlightsTeam') {
      if (typeof value !== 'string' || !Object.hasOwn(sportsExperience.TEAMS, value)) throw fail('invalid_highlights_team');
    } else if (key === 'sports.livePriority') {
      if (!Array.isArray(value) || value.length !== 2 || new Set(value).size !== 2 || value.some((id) => !Object.hasOwn(sportsExperience.TEAMS, id))) throw fail('invalid_live_priority');
    } else if (key === 'sports.enabled' || key === 'sports.liveGames') {
      if (typeof value !== 'boolean') throw fail('invalid_sports');
    } else if (key === 'sports.teams') {
      if (
        !Array.isArray(value) ||
        value.length > 32 ||
        value.some(
          (t) =>
            !['string', 'number'].includes(typeof t) || String(t).length > 80,
        )
      )
        throw fail('invalid_teams');
    } else if (key === 'weather.units') {
      if (!['imperial', 'metric'].includes(value)) throw fail('invalid_units');
    } else if (key === 'display.clockFormat') {
      if (!['12h', '24h'].includes(value)) throw fail('invalid_clock_format');
    } else if (typeof value !== 'string' || !value.trim() || value.length > 200)
      throw fail('invalid_preference');
  }
  return values;
}
get('/clock/state', (_, res) => res.json(clock.getState()));
get('/clock/history', (_, res) => res.json({ alarms: clock.history() }));
post('/clock/command', async (req, res) =>
  res.json(await clock.command(req.body)),
);
get('/lights', (_, res) =>
  res.json({ lights: lights.list(), groupPresets: lights.groupPresets() }),
);
post('/lights/group', async (req, res) => {
  if (req.body?.restart !== undefined) throw fail('unsupported_group_action');
  res.json(await lights.group(req.body));
});
post('/lights/:id/command', async (req, res) => {
  if (req.body?.restart !== undefined) throw fail('use_device_maintenance');
  res.json(await lights.command(req.params.id, req.body));
});
get('/devices', (_, res) => res.json({ devices: devices.list() }));
post('/devices/:id/actions', async (req, res) => {
  if (req.body?.confirm !== true) throw fail('confirmation_required');
  res.json(await devices.action(req.params.id, req.body.action));
});
get('/sports/experience', async (_, res) => res.json(await sportsExperience.getExperience({ includeHighlights: false })));
post('/sports/selection', async (req, res) => {
  await sportsExperience.select(req.body);
  consoleService.broadcastState();
  activity.record('mirror', `Sports display: ${req.body.mode === 'auto' ? 'automatic live-game priority' : req.body.mode === 'game' ? 'live game selected' : 'highlights selected'}`);
  consoleService.broadcastPageData('sports').catch(() => require('../utils/logger').warn('Sports display refresh failed'));
  res.json(await sportsExperience.getExperience({ includeHighlights: false }));
});
get('/activity', (_, res) => res.json({ entries: activity.list() }));
get('/nexus/config', (_, res) => res.json(config.get()));
post('/nexus/config', (req, res) => {
  const before = config.get();
  const saved = config.save(req.body);
  events.emit('nexus_config', saved);
  if (
    JSON.stringify(before.devices.map((d) => [d.id, d.address])) !==
    JSON.stringify(saved.devices.map((d) => [d.id, d.address]))
  )
    lights.reconfigure();
  events.emit('devices_state', devices.list());
  res.json(saved);
});
post('/nexus/preferences', async (req, res) => {
  validSettings(req.body);
  await settings.updateMultiple(req.body);
  if (req.body['weather.units'] || req.body['display.clockFormat']) {
    const current = config.get();
    if (req.body['weather.units'])
      current.preferences.temperature =
        req.body['weather.units'] === 'metric' ? 'celsius' : 'fahrenheit';
    if (req.body['display.clockFormat'])
      current.preferences.clockFormat = req.body['display.clockFormat'];
    config.save(current);
    events.emit('nexus_config', current);
  }
  require('./websocket').broadcastSettingsUpdate(settings.getAll());
  await consoleService.handleSettingsChanged('nexus:preferences', { awaitPageData: false });
  res.json({ ok: true });
});
post('/console/button', async (req, res) => {
  const id = req.body?.buttonId;
  if (
    !['button1', 'button2', 'button3', 'button4'].includes(id) ||
    Object.keys(req.body).some((key) => key !== 'buttonId')
  )
    throw fail('invalid_button');
  const current = consoleService.getState();
  if (!current.softButtons?.[id]) throw fail('button_unavailable', 409);
  const event =
    id === 'button1'
      ? {
          type: 'display.page.toggle',
          payload: { pageId: current.activePageId, hold: false },
        }
      : {
          type: 'ui.action',
          payload: {
            pageId: current.activePageId,
            buttonId: id,
            action: {
              button2: 'primary',
              button3: 'previous',
              button4: 'next',
            }[id],
            hold: false,
          },
        };
  await sceneEngine.handleEsp32Event({
    ...event,
    deviceId: 'nexus-pwa',
    timestamp: Date.now(),
  });
  if (id === 'button1') activity.record('mirror', `Mirror remote: ${consoleService.getState().pageTitle || 'page changed'}`);
  res.json({ ok: true, state: consoleService.getState() });
});
post('/display/standby', async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') throw fail('invalid_enabled');
  await sceneEngine.applyStandbyMode(req.body.enabled, 'nexus:standby');
  activity.record('mirror', req.body.enabled ? 'Mirror entered standby' : 'Mirror woke');
  res.json({ ok: true, state: consoleService.getState() });
});
get('/config/export', (_, res) => {
  const values = Object.fromEntries(
    SETTINGS_KEYS.map((key) => [key, settings.get(key)]).filter(
      ([, value]) => value !== undefined,
    ),
  );
  // Only values accepted by our import schema leave the server.
  const clean = {};
  for (const [key, value] of Object.entries(values)) {
    try {
      validSettings({ [key]: value });
      clean[key] = value;
    } catch (_) {
      /* Legacy unknown settings are omitted. */
    }
  }
  res
    .set('Cache-Control', 'no-store')
    .json({ version: 1, config: config.get(), settings: clean });
});
post('/config/import', async (req, res) => {
  const input = req.body?.document;
  if (
    !input ||
    input.version !== 1 ||
    Object.keys(input).some(
      (key) => !['version', 'config', 'settings'].includes(key),
    )
  )
    throw fail('invalid_backup');
  const clean = config.validateConfig(input.config);
  const values = validSettings(input.settings);
  if (req.body.confirm !== true)
    return res.json({
      preview: {
        devices: clean.devices.map((d) => ({ id: d.id, name: d.name })),
        settings: Object.keys(values),
      },
    });
  // Capture both previous stores so a failed settings write cannot partially replace configuration.
  const oldConfig = config.get();
  config.save(clean);
  try {
    await settings.updateMultiple(values);
  } catch (error) {
    config.save(oldConfig);
    throw error;
  }
  lights.reconfigure();
  events.emit('nexus_config', config.get());
  require('./websocket').broadcastSettingsUpdate(settings.getAll());
  res.json({ ok: true });
});
module.exports = router;
module.exports.validSettings = validSettings;
