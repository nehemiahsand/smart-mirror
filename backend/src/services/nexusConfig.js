const RuntimeStore = require('../utils/runtimeStore');
const fs = require('fs');
const fail = require('../utils/serviceError');

const DEFAULT_DEVICES = [
  { id: 'mirror', name: 'Mirror / Pi', kind: 'pi' },
  { id: 'mirror-entry-1', name: 'ESP console', kind: 'console' },
  { id: 'smart-clock', name: 'Smart clock', kind: 'clock' },
  { id: 'desk', name: 'Desk', kind: 'wled', favorites: [] },
  { id: 'monitor', name: 'Monitor', kind: 'wled', favorites: [] },
  { id: 'mac', name: 'Mac', kind: 'computer' },
  { id: 'thinkpad', name: 'ThinkPad', kind: 'computer' },
];
const DEFAULT_CONFIG = {
  version: 1,
  devices: DEFAULT_DEVICES,
  groupPresets: [],
  preferences: { temperature: 'fahrenheit', clockFormat: '12h' },
};
const plain = (v) => v && Object.getPrototypeOf(v) === Object.prototype;
function only(object, keys) {
  if (!plain(object) || Object.keys(object).some((key) => !keys.includes(key)))
    throw fail('invalid_configuration');
}
function text(value, max = 120) {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
function validUrl(value) {
  if (!value) return;
  let url;
  try {
    url = new URL(value);
  } catch (_) {
    throw fail('invalid_url');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    [...url.searchParams.keys()].some(key => /token|password|secret|authorization|api.?key/i.test(key)) ||
    value.length > 500
  )
    throw fail('invalid_url');
}
function validateConfig(value) {
  only(value, ['version', 'devices', 'groupPresets', 'preferences']);
  if (
    value.version !== 1 ||
    !Array.isArray(value.devices) ||
    value.devices.length > 32
  )
    throw fail('invalid_configuration');
  const ids = new Set();
  for (const device of value.devices) {
    only(device, ['id', 'name', 'kind', 'address', 'remoteUrl', 'favorites']);
    if (
      typeof device.id !== 'string' ||
      !/^[a-z0-9._-]{1,64}$/.test(device.id) ||
      ids.has(device.id) ||
      !text(device.name) ||
      !['pi', 'console', 'clock', 'wled', 'computer'].includes(device.kind)
    )
      throw fail('invalid_device');
    ids.add(device.id);
    validUrl(device.remoteUrl);
    if (device.address) {
      validUrl(device.address);
      const address = new URL(device.address);
      if (
        device.kind !== 'wled' ||
        address.pathname !== '/' ||
        address.search ||
        address.hash
      )
        throw fail('invalid_device_address');
    }
    if (device.favorites !== undefined) {
      if (!Array.isArray(device.favorites) || device.favorites.length > 8)
        throw fail('invalid_favorites');
      device.favorites.forEach((favorite) => {
        only(favorite, ['name', 'presetId', 'color']);
        if (
          !text(favorite.name, 32) ||
          (favorite.presetId === undefined) === (favorite.color === undefined)
        )
          throw fail('invalid_favorite');
        if (
          favorite.presetId !== undefined &&
          (!Number.isInteger(favorite.presetId) ||
            favorite.presetId < 1 ||
            favorite.presetId > 250)
        )
          throw fail('invalid_preset');
        if (
          favorite.color !== undefined &&
          !/^#[a-f0-9]{6}$/i.test(favorite.color)
        )
          throw fail('invalid_color');
      });
    }
  }
  only(value.preferences, ['temperature', 'clockFormat']);
  if (
    !['fahrenheit', 'celsius'].includes(value.preferences.temperature) ||
    !['12h', '24h'].includes(value.preferences.clockFormat)
  )
    throw fail('invalid_preferences');
  if (!Array.isArray(value.groupPresets) || value.groupPresets.length > 8)
    throw fail('invalid_group_presets');
  if (new Set(value.groupPresets.map(p => p?.name)).size !== value.groupPresets.length) throw fail('duplicate_group_preset_name');
  for (const preset of value.groupPresets) {
    only(preset, ['name', 'devices']);
    if (!text(preset.name, 32) || !plain(preset.devices))
      throw fail('invalid_group_preset');
    for (const [id, number] of Object.entries(preset.devices)) {
      if (
        !value.devices.some((d) => d.id === id && d.kind === 'wled') ||
        !Number.isInteger(number) ||
        number < 1 ||
        number > 250
      )
        throw fail('invalid_group_preset');
    }
    if (
      Object.keys(preset.devices).length !==
      value.devices.filter((d) => d.kind === 'wled').length
    )
      throw fail('incomplete_group_preset');
  }
  return JSON.parse(JSON.stringify(value));
}
class NexusConfig {
  constructor() {
    this.store = new RuntimeStore('nexus-config.json', DEFAULT_CONFIG);
  }
  get() {
    const value = this.store.read();
    if (!fs.existsSync(this.store.file)) {
      const settings = require('./settings');
      value.preferences = {
        temperature:
          settings.get('weather.units') === 'metric' ? 'celsius' : 'fahrenheit',
        clockFormat: settings.get('display.clockFormat') || '12h',
      };
    }
    return validateConfig(value);
  }
  save(value) {
    const clean = validateConfig(value);
    this.store.write(clean);
    return clean;
  }
}
module.exports = new NexusConfig();
module.exports.validateConfig = validateConfig;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
