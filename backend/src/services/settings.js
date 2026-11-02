/**
 * Settings service - manages persistent settings stored as JSON
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { normalizeSportsPreferences } = require('../utils/sportsTeams');

const SETTINGS_DIR = process.env.NEXUS_DATA_DIR || path.join(__dirname, '../../data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');
const SENSITIVE_KEY_PATTERNS = [/token/i, /secret/i, /password/i, /api.?key/i, /authorization/i];
const SENSITIVE_PATHS = new Set([
  'traffic.origin',
  'traffic.destination',
  'traffic.destinations'
]);

function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key)));
}

function isSensitivePath(key) {
  return SENSITIVE_PATHS.has(String(key));
}

const DEFAULT_SETTINGS = {
  display: {
    brightness: 100,
    orientation: 'landscape',
    clockFormat: '24h',
    standbyMode: false
  },
  weather: {
    city: 'Birmingham,US',
    units: 'imperial',
    updateInterval: 600000
  },
  sports: {
    highlightsTeam: 'gsw',
    liveGames: true,
    livePriority: ['auburn', 'gsw'],
    enabled: false,
    sport: 'nba',
    defaultSport: 'nba',
    teams: []
  },
  traffic: {
    enabled: false,
    origin: '',
    destination: '',
    destinations: [],
    googleMapsApiKey: '',
    tomtomApiKey: ''
  },
  widgets: {
    clock: true,
    weather: true,
    calendar: false,
    news: false,
    traffic: true
  },
  network: {
    ssid: null,
    connected: false
  },
  spotify: {
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null
  },
  camera: {
    enabled: true
  },
  presence: {
    enabled: true,
    standbyOnIdle: true,
    idleTimeoutSeconds: 300,
    wakeOnMotion: true,
    wakeSuppressionSeconds: 8
  },
  console: {
    inactivityTimeoutSeconds: 300
  },
  sensorSource: {
    climatePrimary: 'esp32',
    compareMode: false
  },
  widgetOrder: ['timedate', 'googlecalendar', 'weathertemp', 'photos'],
  weatherWidgetOrder: ['timedate', 'sunmoon', 'temps', 'hourly'],
  sportsWidgetOrder: ['timedate', 'highlights'],
  current_scene: 'day',
  current_page: 'home'
};

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function mergeSettings(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? [...override] : [...base];
  }

  if (!base || typeof base !== 'object') {
    return override === undefined ? base : override;
  }

  const result = { ...base };
  const source = override && typeof override === 'object' ? override : {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    const baseValue = base[key];
    if (Array.isArray(value)) {
      result[key] = [...value];
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeSettings(
        baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue) ? baseValue : {},
        value
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

class SettingsService {
  constructor() {
    this.settings = cloneDefaultSettings();
    this.initialized = false;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(SETTINGS_DIR, { recursive: true });
      
      // Try to load existing settings
      try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        const loadedSettings = JSON.parse(data);
        this.settings = mergeSettings(cloneDefaultSettings(), loadedSettings);
        this.settings.sports = normalizeSportsPreferences(this.settings.sports);
        logger.info('Settings loaded successfully');

        const normalizedSettings = JSON.stringify(this.settings);
        if (normalizedSettings !== JSON.stringify(loadedSettings)) {
          await this.save();
          logger.info('Settings file migrated to current schema');
        }
      } catch (error) {
        // File doesn't exist, create with defaults
        await this.save();
        logger.info('Settings file created with defaults');
      }
      
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize settings service', { error: error.message });
      throw error;
    }
  }

  async save(snapshot = this.settings) {
    try {
      await fs.writeFile(`${SETTINGS_FILE}.tmp`, JSON.stringify(snapshot, null, 2), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(`${SETTINGS_FILE}.tmp`, SETTINGS_FILE);
      logger.debug('Settings saved to disk');
    } catch (error) {
      logger.error('Failed to save settings', { error: error.message });
      throw error;
    }
  }

  getAll() {
    return this.settings;
  }

  get(key) {
    const keys = key.split('.');
    let value = this.settings;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  async update(key, value) {
    return this.updateMultiple({ [key]: value });
  }

  async updateMultiple(updates) {
    if (Object.keys(updates).some(key => key.split('.').some(part => ['__proto__', 'constructor', 'prototype'].includes(part)))) throw new Error('Invalid settings path');
    this.updateQueue = (this.updateQueue || Promise.resolve()).catch(() => {}).then(async () => {
      const next = JSON.parse(JSON.stringify(this.settings));
      for (const [key, value] of Object.entries(updates)) {
        const keys = key.split('.');
        let target = next;
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i];
          if (!target[k] || typeof target[k] !== 'object') target[k] = {};
          target = target[k];
        }
        target[keys[keys.length - 1]] = value;
      }
      next.sports = normalizeSportsPreferences(next.sports);
      await this.save(next);
      this.settings = next;
      const updatedKeys = Object.keys(updates).map(key => (isSensitiveKey(key) || isSensitivePath(key)) ? `${key}:[REDACTED]` : key);
      logger.info('Multiple settings updated', { count: updatedKeys.length, keys: updatedKeys });
      return this.settings;
    });
    return this.updateQueue;
  }

  async reset() {
    this.updateQueue = (this.updateQueue || Promise.resolve()).catch(() => {}).then(async () => {
      const next = cloneDefaultSettings();
      next.sports = normalizeSportsPreferences(next.sports);
      await this.save(next);
      this.settings = next;
      logger.info('Settings reset to defaults');
      return this.settings;
    });
    return this.updateQueue;
  }
}

module.exports = new SettingsService();
