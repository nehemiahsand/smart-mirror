/**
 * DHT22 Temperature and Humidity Sensor Reader
 * GPIO 4 default
 * Reads every 2 seconds with Celsius to Fahrenheit conversion
 * 
 * Raspberry Pi 5 compatible - uses Python HTTP server for RP1 chip support
 */

const logger = require('../utils/logger');
const http = require('http');

const sensorAvailable = true; // Always available via Python HTTP server

class DHT22Service {
  constructor() {
    this.gpioPin = parseInt(process.env.DHT22_GPIO_PIN) || 4;
    this.lastReading = null;
    this.lastReadTime = null;
    this.readInterval = 2000; // 2 seconds between reads
    this.autoReadTimer = null;
    this.sensorServerUrl = 'http://127.0.0.1:5555';
    this.cacheTimeout = 30000; // Cache readings for 30 seconds
    
    this.initialize();
    // Auto-read NOT started - will be controlled by standby mode
  }

  initialize() {
    logger.info('DHT22 sensor initialized (Pi 5 compatible)', { gpio: this.gpioPin });
  }

  /**
   * Convert Celsius to Fahrenheit
   */
  celsiusToFahrenheit(celsius) {
    return (celsius * 9/5) + 32;
  }

  /**
   * Read sensor data
   * On failure, returns last known value
   */
  async read() {
    return new Promise((resolve) => {
      http.get(this.sensorServerUrl, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            
            if (result.error) {
              logger.error('DHT22 sensor error', { error: result.error });
              
              // Return last known value on error
              if (this.lastReading) {
                resolve({ ...this.lastReading, stale: true });
              } else {
                resolve({ error: result.error });
              }
              return;
            }

            // Convert temperatures
            const temperatureCelsius = result.temperature;
            const temperatureFahrenheit = this.celsiusToFahrenheit(temperatureCelsius);

            const reading = {
              temperatureCelsius: Math.round(temperatureCelsius * 10) / 10,
              temperatureFahrenheit: Math.round(temperatureFahrenheit * 10) / 10,
              humidity: Math.round(result.humidity * 10) / 10,
              timestamp: new Date().toISOString(),
              stale: false
            };

            this.lastReading = reading;
            this.lastReadTime = Date.now();

            logger.debug('DHT22 sensor read successful', reading);
            resolve(reading);
          } catch (parseError) {
            logger.error('Failed to parse sensor data', { error: parseError.message });
            resolve({ error: 'Failed to parse sensor data' });
          }
        });
      }).on('error', (error) => {
        logger.error('Failed to read DHT22 sensor', {
          error: error.message,
          gpio: this.gpioPin
        });
        
        // Return last known value on failure
        if (this.lastReading) {
          logger.debug('Returning last known sensor reading after failure');
          resolve({ ...this.lastReading, stale: true });
        } else {
          resolve({
            error: 'Sensor read failed',
            message: error.message
          });
        }
      });
    });
  }

  /**
   * Get current reading (cached for efficiency)
   * Returns cached reading if less than 30 seconds old, otherwise performs a read
   */
  async getCurrentReading() {
    // If we have a recent reading (within last 30 seconds), return it
    const now = Date.now();
    if (this.lastReading && this.lastReadTime && (now - this.lastReadTime) < this.cacheTimeout) {
      return this.lastReading;
    }

    // Otherwise, perform a new read
    return await this.read();
  }

  /**
   * Start automatic reading every 2 seconds
   */
  startAutoRead() {
    if (!sensorAvailable) {
      logger.warn('Cannot start auto-read - sensor not available');
      return;
    }

    if (this.autoReadTimer) {
      clearInterval(this.autoReadTimer);
    }

    this.autoReadTimer = setInterval(async () => {
      await this.read();
    }, this.readInterval);

    logger.info('Started automatic sensor reading', { 
      interval: this.readInterval,
      gpio: this.gpioPin 
    });
  }

  /**
   * Stop automatic reading
   */
  stopAutoRead() {
    if (this.autoReadTimer) {
      clearInterval(this.autoReadTimer);
      this.autoReadTimer = null;
      logger.info('Stopped automatic sensor reading');
    }
  }

  /**
   * Legacy method for continuous reading with callback
   */
  async readContinuous(callback, interval = 2000) {
    if (!sensorAvailable) {
      logger.warn('Cannot start continuous reading - sensor not available');
      return null;
    }

    const intervalId = setInterval(async () => {
      const reading = await this.read();
      if (!reading.error) {
        callback(reading);
      }
    }, interval);

    logger.info('Started continuous sensor reading', { interval });
    return intervalId;
  }

  stopContinuous(intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
      logger.info('Stopped continuous sensor reading');
    }
  }

  getLastReading() {
    return this.lastReading;
  }

  isAvailable() {
    return sensorAvailable;
  }

  /**
   * Cleanup on shutdown
   */
  destroy() {
    this.stopAutoRead();
  }
}

module.exports = new DHT22Service();
