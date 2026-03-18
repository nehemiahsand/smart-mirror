const fs = require('fs').promises;
const path = require('path');

// Mock the entire fs.promises module and logger
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn()
  }
}));
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const settingsService = require('../src/services/settings');

describe('Settings Service (Frontend Backbone)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to defaults so tests don't leak state
    settingsService.initialized = false;
    settingsService.settings = {
      display: { brightness: 100, orientation: 'landscape', clockFormat: '24h', standbyMode: false },
      weather: { city: 'Birmingham,US', units: 'imperial', updateInterval: 600000 },
      widgets: { clock: true }
    };
  });

  describe('initialize()', () => {
    it('should create default settings if file does not exist', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      fs.writeFile.mockResolvedValue();

      await settingsService.initialize();

      // Should create data dir and save default settings
      expect(fs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
      expect(settingsService.getAll().display.brightness).toBe(100);
      expect(settingsService.initialized).toBe(true);
    });

    it('should load and merge existing settings from disk', async () => {
      const savedData = { display: { brightness: 50 }, newUnknownField: true };
      fs.readFile.mockResolvedValue(JSON.stringify(savedData));
      fs.writeFile.mockResolvedValue();

      await settingsService.initialize();

      const currentSettings = settingsService.getAll();
      expect(currentSettings.display.brightness).toBe(50); // Overridden
      expect(currentSettings.display.orientation).toBe('landscape'); // Default merged in
      expect(currentSettings.newUnknownField).toBe(true); // Kept unknown fields
    });
  });

  describe('get() and update() dot-notation', () => {
    beforeEach(async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      await settingsService.initialize();
    });

    it('should retrieve nested values correctly', () => {
      const val = settingsService.get('weather.city');
      expect(val).toBe('Birmingham,US');
      
      const missing = settingsService.get('weather.missingField');
      expect(missing).toBeUndefined();
    });

    it('should update nested values and save to disk', async () => {
      fs.writeFile.mockClear();

      await settingsService.update('weather.city', 'London,UK');
      
      expect(settingsService.get('weather.city')).toBe('London,UK');
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
    });

    it('should create nested objects if path does not exist during update', async () => {
      await settingsService.update('custom.deep.path.value', 42);
      
      expect(settingsService.get('custom.deep.path.value')).toBe(42);
    });
  });

  describe('updateMultiple()', () => {
    beforeEach(async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      await settingsService.initialize();
    });

    it('should update multiple nested paths at once', async () => {
      await settingsService.updateMultiple({
        'display.brightness': 75,
        'widgets.news': true
      });

      expect(settingsService.get('display.brightness')).toBe(75);
      expect(settingsService.get('widgets.news')).toBe(true);
    });
  });

  describe('reset()', () => {
    it('should restore factory defaults', async () => {
      fs.readFile.mockRejectedValue(new Error('ENOENT'));
      await settingsService.initialize();

      await settingsService.update('display.brightness', 10);
      expect(settingsService.get('display.brightness')).toBe(10);

      await settingsService.reset();
      expect(settingsService.get('display.brightness')).toBe(100); // Back to default
    });
  });
});
