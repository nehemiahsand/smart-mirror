const logger = require('../utils/logger');
const settingsService = require('./settings');

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function celsiusToFahrenheit(value) {
  return (value * 9 / 5) + 32;
}

function fahrenheitToCelsius(value) {
  return (value - 32) * 5 / 9;
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

class ClimateService {
  constructor() {
    this.esp32Reading = null;
  }

  getPrimarySource() {
    return 'esp32';
  }

  isCompareModeEnabled() {
    return false;
  }

  normalizeEsp32Reading(payload = {}, meta = {}) {
    const humidity = toNumber(payload.humidity);
    const explicitCelsius = toNumber(payload.temperatureCelsius ?? payload.tempC ?? payload.celsius);
    const explicitFahrenheit = toNumber(payload.temperatureFahrenheit ?? payload.tempF ?? payload.fahrenheit);
    const genericTemperature = toNumber(payload.temperature ?? payload.temp);
    const declaredUnits = String(payload.units || payload.scale || '').toLowerCase();

    let temperatureCelsius = explicitCelsius;
    let temperatureFahrenheit = explicitFahrenheit;

    if (temperatureCelsius == null && temperatureFahrenheit == null && genericTemperature != null) {
      if (declaredUnits === 'imperial' || declaredUnits === 'fahrenheit' || declaredUnits === 'f') {
        temperatureFahrenheit = genericTemperature;
      } else {
        temperatureCelsius = genericTemperature;
      }
    }

    if (temperatureCelsius == null && temperatureFahrenheit != null) {
      temperatureCelsius = fahrenheitToCelsius(temperatureFahrenheit);
    }

    if (temperatureFahrenheit == null && temperatureCelsius != null) {
      temperatureFahrenheit = celsiusToFahrenheit(temperatureCelsius);
    }

    if (temperatureCelsius == null || temperatureFahrenheit == null || humidity == null) {
      return null;
    }

    return {
      temperatureCelsius: roundToTenth(temperatureCelsius),
      temperatureFahrenheit: roundToTenth(temperatureFahrenheit),
      humidity: roundToTenth(humidity),
      timestamp: new Date(payload.timestamp || meta.timestamp || Date.now()).toISOString(),
      stale: false,
      source: 'esp32',
      sourceId: meta.deviceId || payload.sourceId || payload.deviceId || 'esp32',
      sensorTimestamp: payload.timestamp || meta.timestamp || Date.now(),
    };
  }

  recordEsp32Reading(payload = {}, meta = {}) {
    const reading = this.normalizeEsp32Reading(payload, meta);
    if (!reading) {
      logger.warn('Ignoring invalid ESP32 climate reading', {
        deviceId: meta.deviceId || 'unknown',
      });
      return null;
    }

    this.esp32Reading = reading;
    logger.info('ESP32 climate reading stored', {
      deviceId: reading.sourceId,
      temperatureFahrenheit: reading.temperatureFahrenheit,
      humidity: reading.humidity,
    });
    return this.esp32Reading;
  }

  getEsp32Reading() {
    return this.esp32Reading ? { ...this.esp32Reading } : null;
  }

  async getComparison() {
    const esp32Reading = this.getEsp32Reading();
    const primarySource = this.getPrimarySource();
    const selectedReading = esp32Reading;

    return {
      primarySource,
      compareMode: this.isCompareModeEnabled(),
      selected: selectedReading,
      pi: null,
      esp32: esp32Reading,
      availableSources: [esp32Reading ? 'esp32' : null].filter(Boolean),
    };
  }

  async getCurrentReading() {
    const comparison = await this.getComparison();
    if (!comparison.selected) {
      return { error: 'No climate reading available' };
    }

    return {
      ...comparison.selected,
      primarySource: comparison.primarySource,
      compareMode: comparison.compareMode,
      comparison: comparison.compareMode
        ? {
            pi: comparison.pi,
            esp32: comparison.esp32,
          }
        : undefined,
    };
  }
}

module.exports = new ClimateService();
