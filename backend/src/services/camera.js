/**
 * Camera Service
 * Integrates with the lightweight camera sidecar (MJPEG streaming + enable/disable).
 * Presence/motion comes from the ESP32 (see sceneEngine), not from camera-side AI.
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
      const sceneEngine = require("./sceneEngine");
      const sceneState = sceneEngine.getState();
      const presenceEnabled = require("./settings").get('presence.enabled') !== false;
      const standbyEnabled = presenceEnabled && require("./settings").get('presence.standbyOnIdle') !== false;
      const isStandby = sceneState.isStandby === true;
      const motionDetected = sceneState.motionActive === true;
      const idleTimeoutMs = sceneEngine.getIdleTimeoutMs();
      const lastDetection = sceneState.lastMotionAt || null;

      let standbyCountdownState = 'disabled';
      let timeUntilStandby = null;

      if (presenceEnabled === false) {
        standbyCountdownState = 'presence_disabled';
      } else if (standbyEnabled === false) {
        standbyCountdownState = 'auto_standby_disabled';
      } else if (isStandby) {
        standbyCountdownState = 'in_standby';
        timeUntilStandby = 0;
      } else if (motionDetected) {
        standbyCountdownState = 'paused_motion_active';
        timeUntilStandby = idleTimeoutMs;
      } else if (lastDetection) {
        standbyCountdownState = 'counting_down';
        timeUntilStandby = Math.max(0, idleTimeoutMs - (Date.now() - lastDetection));
      } else {
        standbyCountdownState = 'waiting_for_first_motion';
      }

      return {
        available: this.isAvailable,
        enabled: response.data.enabled !== false,
        motion_detected: motionDetected,
        total_detections: response.data.total_detections,
        fps: response.data.fps,
        stream_viewers: response.data.stream_viewers || 0,
        stream_resolution: response.data.stream_resolution || null,
        stream_fps_limit: response.data.stream_fps_limit || null,
        stream_jpeg_quality: response.data.stream_jpeg_quality || null,
        capture_resolution: response.data.capture_resolution || null,
        auto_standby_enabled: standbyEnabled,
        dark_standby_enabled: this.darkStandbyEnabled,
        is_dark: response.data.is_dark,
        brightness: response.data.brightness,
        last_detection: lastDetection,
        standby_countdown_state: standbyCountdownState,
        time_until_standby: timeUntilStandby,
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
    // Auto-shutdown timer functionality removed.
    // Standby remains active until woken via motion/button flows.
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

  async setAutoStandby(enabled) {
    await settingsService.update('presence.standbyOnIdle', enabled);

    const sceneEngine = require('./sceneEngine');
    await sceneEngine.handleSettingsChanged('camera:auto_standby_toggle');

    logger.info(`Auto-standby ${enabled ? 'enabled' : 'disabled'}`);
  }
}

module.exports = new CameraService();
