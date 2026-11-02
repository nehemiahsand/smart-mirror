const mqtt = require('mqtt');
const crypto = require('crypto');
const mqttConfig = require('../utils/mqttConfig');
const fail = require('../utils/serviceError');
const config = require('./nexusConfig');
const clock = require('./clock');
const lights = require('./lights');
const events = require('./nexusEvents');
const activity = require('./activity');
const power = require('./power');
const logger = require('../utils/logger');

const MEASUREMENTS = [
  'cpuPercent',
  'memoryPercent',
  'diskPercent',
  'temperatureC',
  'uptimeSeconds',
  'batteryPercent',
  'platform',
  'hostname',
  'network',
  'services',
];
function cleanTelemetry(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    throw fail('invalid_telemetry');
  const result = {};
  for (const key of MEASUREMENTS) {
    const value = payload[key];
    if (value === undefined || value === null) continue;
    if (['platform', 'hostname', 'network'].includes(key)) {
      if (typeof value !== 'string' || value.length > 200)
        throw fail('invalid_telemetry');
    } else if (key === 'services') {
      if (
        !value ||
        Array.isArray(value) ||
        typeof value !== 'object' ||
        Object.keys(value).length > 20 ||
        Object.entries(value).some(
          ([k, v]) =>
            !/^[a-zA-Z0-9._-]{1,80}$/.test(k) ||
            !['active', 'inactive', 'unknown'].includes(v),
        )
      )
        throw fail('invalid_services');
    } else if (
      !Number.isFinite(value) ||
      value < 0 ||
      (key.endsWith('Percent') && value > 100)
    )
      throw fail('invalid_telemetry');
    result[key] = value;
  }
  return result;
}
class DevicesService {
  constructor() {
    this.client = null;
    this.records = new Map();
    this.pending = new Map();
    this.recent = new Map();
    this.interval = null;
  }
  configured(id) {
    return config.get().devices.find((d) => d.id === id);
  }
  update(id, patch) {
    if (!this.configured(id)) return;
    const previous = this.records.get(id);
    const next = { ...previous, ...patch };
    this.records.set(id, next);
    if (previous && previous.online !== next.online)
      activity.record(
        id,
        `${this.configured(id).name} ${next.online ? 'connected' : 'disconnected'}`,
        next.online ? 'info' : 'error',
      );
    events.emit('devices_state', this.list());
  }
  list() {
    return config.get().devices.map((device) => {
      let record = this.records.get(device.id) || {
        online: false,
        error: 'not_configured',
        capabilities: [],
        measurements: {},
      };
      if (device.kind === 'clock') {
        const c = clock.getState();
        record = {
          online: c.online && c.fresh,
          lastSeen: c.updatedAt,
          error: c.error,
          measurements: c.state
            ? {
                controlMode: c.state.controlMode,
                timeStatus: c.state.timeStatus,
                sharpBusy: c.state.sharpBusy,
                wifiConnected: c.state.wifiConnected,
                mqttConnected: c.state.mqttConnected,
              }
            : {},
          capabilities: [],
        };
      } else if (device.kind === 'wled') {
        const light = lights.list().find((l) => l.id === device.id);
        record = {
          online: light?.online || false,
          lastSeen: light?.updatedAt,
          error: light?.error,
          measurements: light?.info || {},
          capabilities: light?.online ? ['restart'] : [],
        };
      }
      if (device.kind === 'pi')
        record = {
          ...record,
          capabilities: [
            ...new Set([
              ...(record.capabilities || []),
              ...(power.isAvailable() ? ['reboot', 'shutdown'] : []),
            ]),
          ],
        };
      return {
        ...device,
        ...record,
        status:
          record.error === 'not_configured'
            ? 'not_configured'
            : record.online
              ? 'online'
              : 'offline',
      };
    });
  }
  initialize() {
    try {
      const connection = mqttConfig();
      this.client = mqtt.connect(connection.url, {
        ...connection.options,
        clientId: `nexus-devices-${process.pid}`,
      });
      this.client.on('connect', () =>
        this.client.subscribe([
          'smartmirror/devices/+/status',
          'smartmirror/devices/+/telemetry',
          'smartmirror/devices/+/response',
        ]),
      );
      this.client.on('message', (topic, data) => this.receive(topic, data));
      this.client.on('error', () =>
        logger.warn('Device telemetry MQTT unavailable'),
      );
      this.client.on('close', () => {
        for (const id of this.records.keys())
          this.update(id, { online: false });
        for (const p of this.pending.values()) {
          clearTimeout(p.timer);
          p.reject(fail('broker_offline', 503));
        }
        this.pending.clear();
      });
    } catch (_) {
      logger.warn('Device telemetry awaiting MQTT configuration');
    }
    this.interval = setInterval(() => {
      for (const [id, record] of this.records)
        if (
          record.online &&
          Date.now() - record.lastSeen >
            (this.configured(id)?.kind === 'console' ? 180000 : 45000)
        )
          this.update(id, { online: false, error: 'heartbeat_expired' });
    }, 5000);
    this.interval.unref();
    this.onClock = () => events.emit('devices_state', this.list());
    events.on('clock_state', this.onClock);
    events.on('lights_state', this.onClock);
  }
  receive(topic, buffer) {
    const match =
      /^smartmirror\/devices\/([a-z0-9._-]+)\/(status|telemetry|response)$/.exec(
        topic,
      );
    if (
      !match ||
      !this.configured(match[1]) ||
      !['pi', 'computer'].includes(this.configured(match[1]).kind) ||
      buffer.length > 16384
    )
      return;
    const [, id, type] = match;
    try {
      const payload = JSON.parse(buffer.toString());
      if (type === 'status' && payload.online === false)
        this.update(id, { online: false, error: 'device_offline' });
      if (type === 'telemetry') {
        const measurements = cleanTelemetry(payload.measurements);
        const capabilities = Array.isArray(payload.capabilities)
          ? payload.capabilities
              .filter(
                (c) =>
                  typeof c === 'string' &&
                  /^(reboot|shutdown|restart-service:[a-zA-Z0-9._-]{1,80})$/.test(
                    c,
                  ),
              )
              .slice(0, 22)
          : [];
        this.update(id, {
          measurements,
          capabilities,
          lastSeen: Date.now(),
          online: true,
          error: null,
        });
      }
      if (type === 'response') {
        const p = this.pending.get(payload.requestId);
        if (!p) {
          const recent = this.recent.get(payload.requestId);
          if (
            recent?.deviceId === id &&
            ['completed', 'failed'].includes(payload.outcome) &&
            !recent.completed
          ) {
            recent.completed = true;
            activity.record(
              id,
              `${recent.action}: ${payload.outcome}`,
              payload.outcome === 'failed' ? 'error' : 'info',
            );
          }
          return;
        }
        if (p.deviceId !== id || typeof payload.ok !== 'boolean') return;
        clearTimeout(p.timer);
        this.pending.delete(payload.requestId);
        this.recent.set(payload.requestId, p);
        if (this.recent.size > 100)
          this.recent.delete(this.recent.keys().next().value);
        if (payload.ok) p.resolve({ ...payload, outcome: 'accepted' });
        else p.reject(fail('agent_action_rejected', 409));
        activity.record(
          id,
          `${p.action}: ${payload.ok ? 'accepted' : 'rejected'}`,
          payload.ok ? 'info' : 'error',
        );
      }
    } catch (_) {
      logger.warn('Invalid device telemetry payload');
    }
  }
  consoleEvent(event) {
    if (
      !this.configured(event.deviceId) ||
      this.configured(event.deviceId).kind !== 'console'
    )
      return;
    const previous = this.records.get(event.deviceId);
    const patch = {
      online: event.type !== 'device.offline',
      lastSeen: Date.now(),
      error: null,
      capabilities: [],
    };
    if (event.type === 'climate.reading')
      patch.measurements = {
        ...previous?.measurements,
        ...Object.fromEntries(
          ['temperatureCelsius', 'temperatureFahrenheit', 'humidity']
            .filter((k) => Number.isFinite(event.payload?.[k]))
            .map((k) => [k, event.payload[k]]),
        ),
      };
    this.update(event.deviceId, patch);
  }
  async action(id, action) {
    const device = this.list().find((d) => d.id === id);
    if (!device || !device.capabilities.includes(action))
      throw fail('unsupported_device_action', 409);
    if (device.kind === 'pi' && ['reboot', 'shutdown'].includes(action)) {
      await power[action]();
      activity.record(id, `${action} requested`);
      return { ok: true, outcome: 'accepted' };
    }
    if (device.kind === 'wled') return lights.command(id, { restart: true });
    if (!device.online || !this.client?.connected)
      throw fail('device_offline', 503);
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(fail('command_timeout_unknown_outcome', 504));
      }, 10000);
      this.pending.set(requestId, {
        deviceId: id,
        action,
        resolve,
        reject,
        timer,
      });
      this.client.publish(
        `smartmirror/devices/${id}/command`,
        JSON.stringify({ requestId, action, expiresAt: Date.now() + 15000 }),
        { qos: 0, retain: false },
        (error) => {
          if (error && this.pending.has(requestId)) {
            clearTimeout(timer);
            this.pending.delete(requestId);
            reject(fail('publish_failed', 503));
          }
        },
      );
    });
  }
  close() {
    clearInterval(this.interval);
    if (this.onClock) { events.off('clock_state', this.onClock); events.off('lights_state', this.onClock); }
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(fail('service_stopped', 503));
    }
    this.pending.clear();
    this.client?.end(true);
  }
}
module.exports = new DevicesService();
module.exports.DevicesService = DevicesService;
module.exports.cleanTelemetry = cleanTelemetry;
