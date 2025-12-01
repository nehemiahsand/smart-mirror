/**
 * Settings service - manages persistent settings stored as JSON
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const SETTINGS_DIR = path.join(__dirname, '../../data');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');

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
    updateInterval: 600000 // 10 minutes
  },
  widgets: {
    clock: true,
    weather: true,
    calendar: false,
    news: false
  },
  network: {
    ssid: null,
    connected: false
  }
};

class SettingsService {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.initialized = false;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(SETTINGS_DIR, { recursive: true });
      
      // Try to load existing settings
      try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf8');
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
        logger.info('Settings loaded successfully');
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

  async save() {
    try {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf8');
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
    const keys = key.split('.');
    let target = this.settings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in target)) {
        target[k] = {};
      }
      target = target[k];
    }
    
    target[keys[keys.length - 1]] = value;
    await this.save();
    logger.info('Setting updated', { key, value });
    
    return this.settings;
  }

  async updateMultiple(updates) {
    for (const [key, value] of Object.entries(updates)) {
      const keys = key.split('.');
      let target = this.settings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!(k in target)) {
          target[k] = {};
        }
        target = target[k];
      }
      
      target[keys[keys.length - 1]] = value;
    }
    
    await this.save();
    logger.info('Multiple settings updated', { count: Object.keys(updates).length });
    
    return this.settings;
  }

  async reset() {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.save();
    logger.info('Settings reset to defaults');
    
    return this.settings;
  }
}

module.exports = new SettingsService();
