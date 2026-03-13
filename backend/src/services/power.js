const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);
const DBUS_OPTIONS_BASE = [
  '--system',
  '--dest=org.freedesktop.login1',
];
const LOGIN1_OBJECT_PATH = '/org/freedesktop/login1';

async function runLoginManagerCommand(method, methodArgs = [], dbusArgs = []) {
  return execFileAsync('dbus-send', [
    ...DBUS_OPTIONS_BASE,
    ...dbusArgs,
    LOGIN1_OBJECT_PATH,
    method,
    ...methodArgs,
  ]);
}

/**
 * Power service using system D-Bus login1 interface
 * Requires /var/run/dbus mounted into the container.
 */
class PowerService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      await runLoginManagerCommand(
        'org.freedesktop.DBus.Introspectable.Introspect',
        [],
        ['--print-reply']
      );
      this.initialized = true;
      logger.info('Power service initialized via login1 dbus-send');
    } catch (err) {
      logger.error('Failed to initialize power service', { error: err.message });
      this.initialized = false;
    }
  }

  isAvailable() {
    return this.initialized;
  }

  async shutdown(interactive = true) {
    if (!this.isAvailable()) {
      throw new Error('Power service not available');
    }
    logger.warn('System shutdown requested');
    return runLoginManagerCommand('org.freedesktop.login1.Manager.PowerOff', [`boolean:${interactive ? 'true' : 'false'}`]);
  }

  async reboot(interactive = true) {
    if (!this.isAvailable()) {
      throw new Error('Power service not available');
    }
    logger.warn('System reboot requested');
    return runLoginManagerCommand('org.freedesktop.login1.Manager.Reboot', [`boolean:${interactive ? 'true' : 'false'}`]);
  }
}

module.exports = new PowerService();
