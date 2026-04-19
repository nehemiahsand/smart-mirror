/**
 * Camera Service
 * Integrates with the lightweight camera sidecar (MJPEG streaming + enable/disable).
 * Standby is controlled manually via the dashboard or the ESP32 console buttons.
 */

const axios = require('axios');
const logger = require('../utils/logger');
const settingsService = require('./settings');

const CAMERA_URL = process.env.CAMERA_URL || 'http://localhost:5556';
const POLL_INTERVAL = 5000;

class CameraService {
  constructor() {
    this.isAvailable = false;
    this.checkInterval = null;
    this.shutdownTimer = null;
    this.standbyStartTime = null;
    this.isDark = false;
    this.brightness = 100;
    this.darkStandbyEnabled = false;
    this.cameraEnabled = true;
  }

  async initialize() {
    // Retry camera connection with exponential backoff
    const maxRetries = 10;
    const baseDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(`${CAMERA_URL}/health`, { timeout: 5000 });
        const cameraActive = response.data.camera_active;
        
        if (response.data.status === 'ok') {
          this.isAvailable = true;
          logger.info('Camera service is available and responded ok');
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

    logger.info('Starting camera status monitoring...');
    this.checkInterval = setInterval(() => this.pollCameraStatus(), POLL_INTERVAL);
    
    // Initial check
    this.pollCameraStatus();
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Stopped camera status monitoring');
    }
  }

  async pollCameraStatus() {
    if (!this.cameraEnabled) {
      return;
    }
    try {
      const response = await axios.get(`${CAMERA_URL}/detection/status`, { timeout: 3000 });
      const { is_dark, brightness } = response.data;

      this.isDark = is_dark;
      this.brightness = brightness;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Camera service connection refused - may be starting up');
      } else {
        logger.error('Error polling camera status:', error.message);
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
        total_detections: response.data.total_detections,
        fps: response.data.fps,
        stream_viewers: response.data.stream_viewers || 0,
        stream_resolution: response.data.stream_resolution || null,
        stream_fps_limit: response.data.stream_fps_limit || null,
        stream_jpeg_quality: response.data.stream_jpeg_quality || null,
        capture_resolution: response.data.capture_resolution || null,
        dark_standby_enabled: this.darkStandbyEnabled,
        is_dark: response.data.is_dark,
        brightness: response.data.brightness,
        standby_active: settingsService.get('display.standbyMode') === true,
        standby_start_time: this.standbyStartTime,
        time_until_shutdown: null,
        standby_hint: 'Standby only turns the display off. Camera streaming stays available in the dashboard unless Camera Input is disabled.',
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
    // Auto-shutdown timer functionality removed.
    // Standby remains active until changed manually.
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
    this.isDark = false;
    const path = enabled ? '/control/enable' : '/control/disable';
    try {
      await axios.post(`${CAMERA_URL}${path}`, {}, { timeout: 3000 });
      logger.info(`Camera input ${enabled ? 'enabled' : 'disabled'} via camera service`);
    } catch (error) {
      logger.error('Failed to toggle camera input', { error: error.message });
    }
  }

}

module.exports = new CameraService();
