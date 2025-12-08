/**
 * Camera Service
 * Manages AI-based person detection and auto-standby logic
 */

const axios = require('axios');
const logger = require('../utils/logger');
const settingsService = require('./settings');
const displayService = require('./display');

const CAMERA_URL = process.env.CAMERA_URL || 'http://localhost:5556';
const POLL_INTERVAL = 5000; // Check every 5 seconds (matches AI detection interval)
const NO_PERSON_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const STANDBY_SHUTDOWN_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

class CameraService {
  constructor() {
    this.isAvailable = false;
    this.personDetected = false;
    this.lastDetectionTime = null;
    this.checkInterval = null;
    this.autoStandbyEnabled = true;
    this.lastStandbyState = null;
    this.shutdownTimer = null;
    this.standbyStartTime = null;
  }

  async initialize() {
    // Retry camera connection with exponential backoff
    const maxRetries = 10;
    const baseDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(`${CAMERA_URL}/health`, { timeout: 5000 });
        const cameraActive = response.data.camera_active;
        
        if (cameraActive) {
          this.isAvailable = true;
          logger.info('Camera service is available and active');
          this.startMonitoring();
          return;
        } else {
          // Camera service responded but camera not active yet - retry
          const isLastAttempt = attempt === maxRetries;
          if (isLastAttempt) {
            logger.warn('Camera service running but camera not active after all retries');
            this.isAvailable = false;
            return;
          } else {
            const delay = baseDelay * Math.pow(1.5, attempt - 1);
            logger.info(`Camera not active yet, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          if (isLastAttempt) {
            logger.warn(`Camera service not available after ${maxRetries} attempts`);
            this.isAvailable = false;
          } else {
            const delay = baseDelay * Math.pow(1.5, attempt - 1);
            logger.info(`Camera service not responding, retrying in ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } else {
          logger.error('Camera service initialization error:', error.message);
          this.isAvailable = false;
          return;
        }
      }
    }
  }

  startMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    logger.info('Starting person detection monitoring...');
    this.checkInterval = setInterval(() => this.checkPersonDetection(), POLL_INTERVAL);
    
    // Initial check
    this.checkPersonDetection();
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Stopped person detection monitoring');
    }
  }

  async checkPersonDetection() {
    try {
      const response = await axios.get(`${CAMERA_URL}/detection/status`, { timeout: 3000 });
      const { person_detected, total_detections, fps } = response.data;

      const previousState = this.personDetected;
      this.personDetected = person_detected;

      if (person_detected) {
        this.lastDetectionTime = Date.now();
        
        // Person detected - wake from standby if needed and auto-standby is enabled
        if (!previousState && this.autoStandbyEnabled) {
          logger.info('Person detected by AI - waking display');
          await this.wakeDisplay();
        }
      } else {
        // No person detected - check if we should enter standby
        if (this.autoStandbyEnabled && this.lastDetectionTime) {
          const timeSinceLastPerson = Date.now() - this.lastDetectionTime;
          
          if (timeSinceLastPerson >= NO_PERSON_TIMEOUT) {
            logger.info(`No person detected for ${NO_PERSON_TIMEOUT / 60000} minutes - entering standby`);
            await this.enterStandby();
            this.lastDetectionTime = null; // Reset
          }
        } else if (!this.autoStandbyEnabled) {
          // Auto-standby disabled - clear the timer
          this.lastDetectionTime = null;
        }
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Camera service connection refused - may be starting up');
      } else {
        logger.error('Error checking person detection:', error.message);
      }
    }
  }

  async wakeDisplay() {
    try {
      const currentSettings = settingsService.getAll();
      
      if (currentSettings && currentSettings.display && currentSettings.display.standbyMode) {
        logger.info('Waking display from standby (person detected)...');
        
        // Cancel auto-shutdown timer if running
        if (this.shutdownTimer) {
          clearTimeout(this.shutdownTimer);
          this.shutdownTimer = null;
          this.standbyStartTime = null;
          logger.info('Cancelled auto-shutdown timer');
        }
        
        // Use the same logic as the standby button
        await settingsService.updateMultiple({ 'display.standbyMode': false });
        await displayService.turnOn();
        
        // Broadcast settings change to update PWA immediately
        const websocketServer = require('../api/websocket');
        if (websocketServer && typeof websocketServer.broadcastSettingsUpdate === 'function') {
          websocketServer.broadcastSettingsUpdate(settingsService.getAll());
        }
        
        logger.info('Display woken from standby successfully');
      }
    } catch (error) {
      logger.error('Error waking display:', { error: error.message, stack: error.stack });
    }
  }

  async enterStandby() {
    try {
      const currentSettings = settingsService.getAll();
      
      if (currentSettings && currentSettings.display && !currentSettings.display.standbyMode) {
        logger.info('Entering standby mode (no person for 5 minutes)...');
        
        // Use the same logic as the standby button
        await settingsService.updateMultiple({ 'display.standbyMode': true });
        await displayService.turnOff();
        
        // Broadcast settings change to update PWA immediately
        const websocketServer = require('../api/websocket');
        if (websocketServer && typeof websocketServer.broadcastSettingsUpdate === 'function') {
          websocketServer.broadcastSettingsUpdate(settingsService.getAll());
        }
        
        // Start 30-minute auto-shutdown timer
        this.standbyStartTime = Date.now();
        this.shutdownTimer = setTimeout(async () => {
          logger.warn('Auto-shutdown triggered: System in standby for 30 minutes');
          try {
            const powerService = require('./power');
            if (powerService.isAvailable()) {
              await powerService.shutdown(false);
            } else {
              logger.error('Cannot shutdown: Power service not available');
            }
          } catch (error) {
            logger.error('Auto-shutdown failed:', { error: error.message });
          }
        }, STANDBY_SHUTDOWN_TIMEOUT);
        
        logger.info('Display entered standby mode successfully');
        logger.info('Auto-shutdown will trigger in 30 minutes if not woken');
      } else if (currentSettings && currentSettings.display && currentSettings.display.standbyMode) {
        logger.info('Display already in standby mode');
      }
    } catch (error) {
      logger.error('Error entering standby:', { error: error.message, stack: error.stack });
    }
  }

  async getStatus() {
    try {
      const response = await axios.get(`${CAMERA_URL}/detection/status`, { timeout: 3000 });
      return {
        available: this.isAvailable,
        person_detected: response.data.person_detected,
        total_detections: response.data.total_detections,
        fps: response.data.fps,
        auto_standby_enabled: this.autoStandbyEnabled,
        last_detection: this.lastDetectionTime,
        time_until_standby: this.lastDetectionTime 
          ? Math.max(0, NO_PERSON_TIMEOUT - (Date.now() - this.lastDetectionTime))
          : null,
        standby_start_time: this.standbyStartTime,
        time_until_shutdown: this.standbyStartTime
          ? Math.max(0, STANDBY_SHUTDOWN_TIMEOUT - (Date.now() - this.standbyStartTime))
          : null
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  getVideoFeedUrl() {
    return `${CAMERA_URL}/video/feed`;
  }

  startShutdownTimer() {
    // Cancel existing timer if any
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
    }
    
    this.standbyStartTime = Date.now();
    this.shutdownTimer = setTimeout(async () => {
      logger.warn('Auto-shutdown triggered: System in standby for 30 minutes');
      try {
        const powerService = require('./power');
        if (powerService.isAvailable()) {
          await powerService.shutdown(false);
        } else {
          logger.error('Cannot shutdown: Power service not available');
        }
      } catch (error) {
        logger.error('Auto-shutdown failed:', { error: error.message });
      }
    }, STANDBY_SHUTDOWN_TIMEOUT);
    
    logger.info('Auto-shutdown timer started (30 minutes)');
  }

  cancelShutdownTimer() {
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = null;
      this.standbyStartTime = null;
      logger.info('Auto-shutdown timer cancelled');
    }
  }

  setAutoStandby(enabled) {
    this.autoStandbyEnabled = enabled;
    
    if (!enabled) {
      // Disabling auto-standby - reset the countdown timers
      this.lastDetectionTime = null;
      if (this.shutdownTimer) {
        clearTimeout(this.shutdownTimer);
        this.shutdownTimer = null;
        this.standbyStartTime = null;
        logger.info('Cleared auto-shutdown timer');
      }
    } else {
      // Re-enabling auto-standby - reset state and check current person status
      this.lastDetectionTime = null;
      this.personDetected = false;
      // Trigger immediate check to update state
      this.checkPersonDetection();
    }
    
    logger.info(`Auto-standby ${enabled ? 'enabled' : 'disabled'}`);
  }
}

module.exports = new CameraService();
