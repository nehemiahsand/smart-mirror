const crypto = require('crypto');
const RuntimeStore = require('../utils/runtimeStore');
const events = require('./nexusEvents');

class ActivityService {
  constructor() {
    this.store = new RuntimeStore('nexus-activity.json', []);
  }
  list() {
    const cutoff = Date.now() - 30 * 86400000;
    return this.store
      .read()
      .filter((item) => item.timestamp >= cutoff)
      .slice(0, 500);
  }
  record(deviceId, message, level = 'info') {
    const entry = {
      id: crypto.randomUUID(),
      deviceId,
      message,
      level,
      timestamp: Date.now(),
    };
    this.store.write([entry, ...this.list()].slice(0, 500));
    events.emit('activity_event', entry);
  }
}
module.exports = new ActivityService();
