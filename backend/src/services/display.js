const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const logger = require('../utils/logger');

const execAsync = promisify(exec);

/**
 * Display service to control LCD backlight
 * Supports: DRM sysfs (Pi 5), vcgencmd (older Pi), DPMS, vbetool
 */
class DisplayService {
  constructor() {
    this.displayEnv = process.env.DISPLAY || ':0';
    this.drmPath = null;
    this.initDRM();
  }

  /**
   * Find the active DRM display
   */
  async initDRM() {
    try {
      const cards = ['/sys/class/drm/card1/card1-HDMI-A-1', '/sys/class/drm/card0/card0-HDMI-A-1'];
      for (const card of cards) {
        try {
          const status = await fs.readFile(`${card}/status`, 'utf8');
          if (status.trim() === 'connected') {
            this.drmPath = `${card}/dpms`;
            logger.info(`Found DRM display: ${card}`);
            break;
          }
        } catch (err) {
          // Try next card
        }
      }
    } catch (err) {
      logger.debug('DRM detection failed', { error: err.message });
    }
  }

  /**
   * Turn off the display (LCD backlight off)
   */
  async turnOff() {
    try {
      // Try wlr-randr for Wayland (best for Pi 5 with Wayland)
      try {
        await execAsync('wlr-randr --output HDMI-A-1 --off');
        logger.info('Display turned off (wlr-randr)');
        return { success: true };
      } catch (err) {
        logger.debug('wlr-randr not available');
      }

      // Try DRM sysfs first (best for Pi 5)
      if (this.drmPath) {
        try {
          await fs.writeFile(this.drmPath, 'Off');
          logger.info('Display turned off (DRM sysfs)');
          return { success: true };
        } catch (err) {
          logger.debug('DRM sysfs failed, trying alternatives', { error: err.message });
        }
      }

      // Try Raspberry Pi specific command
      try {
        await execAsync('vcgencmd display_power 0');
        logger.info('Display turned off (vcgencmd)');
        return { success: true };
      } catch (err) {
        logger.debug('vcgencmd not available');
      }

      // Try DPMS
      try {
        await execAsync(`DISPLAY=${this.displayEnv} xset dpms force off`);
        logger.info('Display turned off (DPMS)');
        return { success: true };
      } catch (err) {
        logger.debug('DPMS not available');
      }

      // Try vbetool
      try {
        await execAsync('vbetool dpms off');
        logger.info('Display turned off (vbetool)');
        return { success: true };
      } catch (err) {
        logger.debug('vbetool not available');
      }

      throw new Error('No display control method available');
    } catch (err) {
      logger.error('Failed to turn off display', { error: err.message });
      throw new Error(`Failed to turn off display: ${err.message}`);
    }
  }

  /**
   * Turn on the display (LCD backlight on)
   */
  async turnOn() {
    try {
      // Try wlr-randr for Wayland (best for Pi 5 with Wayland)
      try {
        await execAsync('wlr-randr --output HDMI-A-1 --on');
        logger.info('Display turned on (wlr-randr)');
        return { success: true };
      } catch (err) {
        logger.debug('wlr-randr not available');
      }

      // Try DRM sysfs first (best for Pi 5)
      if (this.drmPath) {
        try {
          await fs.writeFile(this.drmPath, 'On');
          logger.info('Display turned on (DRM sysfs)');
          return { success: true };
        } catch (err) {
          logger.debug('DRM sysfs failed, trying alternatives', { error: err.message });
        }
      }

      // Try Raspberry Pi specific command
      try {
        await execAsync('vcgencmd display_power 1');
        logger.info('Display turned on (vcgencmd)');
        return { success: true };
      } catch (err) {
        logger.debug('vcgencmd not available');
      }

      // Try DPMS
      try {
        await execAsync(`DISPLAY=${this.displayEnv} xset dpms force on`);
        logger.info('Display turned on (DPMS)');
        return { success: true };
      } catch (err) {
        logger.debug('DPMS not available');
      }

      // Try vbetool
      try {
        await execAsync('vbetool dpms on');
        logger.info('Display turned on (vbetool)');
        return { success: true };
      } catch (err) {
        logger.debug('vbetool not available');
      }

      throw new Error('No display control method available');
    } catch (err) {
      logger.error('Failed to turn on display', { error: err.message });
      throw new Error(`Failed to turn on display: ${err.message}`);
    }
  }

  /**
   * Get current display status
   */
  async getStatus() {
    try {
      // Try DRM sysfs first
      if (this.drmPath) {
        try {
          const status = await fs.readFile(this.drmPath, 'utf8');
          const isOn = status.trim() === 'On';
          return { 
            on: isOn,
            status: isOn ? 'on' : 'off'
          };
        } catch (err) {
          logger.debug('DRM status read failed');
        }
      }

      // Try vcgencmd
      try {
        const { stdout } = await execAsync('vcgencmd display_power');
        const isOn = stdout.includes('display_power=1');
        return { 
          on: isOn,
          status: isOn ? 'on' : 'off'
        };
      } catch (err) {
        // Fallback to DPMS query
        const { stdout } = await execAsync(`DISPLAY=${this.displayEnv} xset q | grep "Monitor is"`);
        const isOn = stdout.includes('Monitor is On');
        return { 
          on: isOn,
          status: isOn ? 'on' : 'off'
        };
      }
    } catch (err) {
      logger.error('Failed to get display status', { error: err.message });
      return { on: true, status: 'unknown' };
    }
  }
}

module.exports = new DisplayService();
