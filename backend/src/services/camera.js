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
const NO_PERSON_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

class CameraService {
  constructor() {
    this.isAvailable = false;
    this.personDetected = false;
    this.lastDetectionTime = null;
    this.checkInterval = null;
    this.autoStandbyEnabled = false;
    this.lastStandbyState = null;
    this.shutdownTimer = null;
    this.standbyStartTime = null;
    this.isDark = false;
    this.brightness = 100;
    this.darkStandbyEnabled = true; // Enable standby when room goes dark
    this.cameraEnabled = true;
    this.cameraWarmupUntil = 0;
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
    if (!this.cameraEnabled) {
      return;
    }
    try {
      const response = await axios.get(`${CAMERA_URL}/detection/status`, { timeout: 3000 });
      const { person_detected, total_detections, fps, is_dark, brightness } = response.data;

      const previousState = this.personDetected;
      const previousDarkState = this.isDark;
      this.personDetected = person_detected;
      this.isDark = is_dark;
      this.brightness = brightness;

      // After camera is re-enabled, allow a short warmup period to avoid
      // false dark/no-person standby transitions while exposure stabilizes.
      if (Date.now() < this.cameraWarmupUntil) {
        if (person_detected) {
          this.lastDetectionTime = Date.now();
        }
        return;
      }

      // Check for dark room - enter standby immediately when lights go off
      if (this.darkStandbyEnabled && is_dark && !previousDarkState) {
        logger.info(`Room went dark (brightness: ${brightness}) - entering standby`);
        await this.enterStandby();
        return; // Don't process person detection when dark
      }

      // Skip person detection logic if room is dark
      if (is_dark) {
        return;
      }

      if (person_detected) {
        this.lastDetectionTime = Date.now();
        
        if (!previousState) {
          logger.info('Person detected by AI while awake');
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
      if (currentSettings?.display?.standbyMode) {
        const sceneEngine = require('./sceneEngine');
        await sceneEngine.applyStandbyMode(false, 'camera:wake_request');
      }
    } catch (error) {
      logger.error('Error waking display:', { error: error.message, stack: error.stack });
    }
  }

  async enterStandby() {
    try {
      const currentSettings = settingsService.getAll();

      if (currentSettings?.display && !currentSettings.display.standbyMode) {
        const sceneEngine = require('./sceneEngine');
        await sceneEngine.applyStandbyMode(true, 'camera:auto_standby');
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
        enabled: response.data.enabled !== false,
        person_detected: require("./sceneEngine").getState().motionActive || false,
        total_detections: response.data.total_detections,
        fps: response.data.fps,
        stream_viewers: response.data.stream_viewers || 0,
        stream_resolution: response.data.stream_resolution || null,
        stream_fps_limit: response.data.stream_fps_limit || null,
        stream_jpeg_quality: response.data.stream_jpeg_quality || null,
        capture_resolution: response.data.capture_resolution || null,
        auto_standby_enabled: this.autoStandbyEnabled,
        dark_standby_enabled: this.darkStandbyEnabled,
        is_dark: response.data.is_dark,
        brightness: response.data.brightness,
        last_detection: this.lastDetectionTime,
        time_until_standby: this.lastDetectionTime 
          ? Math.max(0, NO_PERSON_TIMEOUT - (Date.now() - this.lastDetectionTime))
          : null,
        standby_start_time: this.standbyStartTime,
        time_until_shutdown: null // Auto-shutdown disabled
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
    // Auto-shutdown timer functionality removed
    // Standby mode will remain indefinitely until person is detected
  }

  cancelShutdownTimer() {
    // Auto-shutdown timer functionality removed
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = null;
      this.standbyStartTime = null;
      logger.info('Auto-shutdown timer cancelled');
    }
  }

  async setCameraEnabled(enabled) {
    this.cameraEnabled = enabled;
    if (enabled) {
      this.cameraWarmupUntil = Date.now() + 20000;
      this.lastDetectionTime = Date.now();
      this.personDetected = false;
      this.isDark = false;
    } else {
      this.cameraWarmupUntil = 0;
    }
    const path = enabled ? '/control/enable' : '/control/disable';
    try {
      await axios.post(`${CAMERA_URL}${path}`, {}, { timeout: 3000 });
      logger.info(`Camera input ${enabled ? 'enabled' : 'disabled'} via camera service`);
    } catch (error) {
      logger.error('Failed to toggle camera input', { error: error.message });
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
