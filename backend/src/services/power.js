const dbus = require('dbus-next');
const logger = require('../utils/logger');

/**
 * Power service using system D-Bus login1 interface
 * Requires /var/run/dbus mounted RW in the container
 */
class PowerService {
  constructor() {
    this.bus = null;
    this.manager = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.bus = dbus.systemBus();
      const obj = await this.bus.getProxyObject('org.freedesktop.login1', '/org/freedesktop/login1');
      this.manager = obj.getInterface('org.freedesktop.login1.Manager');
      this.initialized = true;
      logger.info('Power service initialized via D-Bus login1');
    } catch (err) {
      logger.error('Failed to initialize power service', { error: err.message });
      this.initialized = false;
    }
  }

  isAvailable() {
    return this.initialized && !!this.manager;
  }

  async shutdown(interactive = true) {
    if (!this.isAvailable()) {
      throw new Error('Power service not available');
    }
    logger.warn('System shutdown requested');
    return this.manager.PowerOff(interactive);
  }

  async reboot(interactive = true) {
    if (!this.isAvailable()) {
      throw new Error('Power service not available');
    }
    logger.warn('System reboot requested');
    return this.manager.Reboot(interactive);
  }
}

module.exports = new PowerService();
