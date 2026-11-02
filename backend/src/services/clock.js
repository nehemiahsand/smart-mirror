const mqtt = require('mqtt');
const { DateTime } = require('luxon');
const mqttConfig = require('../utils/mqttConfig');
const fail = require('../utils/serviceError');
const RuntimeStore = require('../utils/runtimeStore');
const events = require('./nexusEvents');
const activity = require('./activity');
const logger = require('../utils/logger');
const PREFIX = 'smartmirror/esp32/smart-clock';
const ACTIONS = {
  'master.set': ['enabled'],
  'alarm.upsert': [
    'id',
    'enabled',
    'recurring',
    'hour',
    'minute',
    'weekdayMask',
    'epoch',
  ],
  'alarm.set_enabled': ['id', 'enabled'],
  'alarm.delete': ['id'],
  'timer.create': ['minutes'],
  'timer.set_enabled': ['id', 'enabled'],
  'timer.delete': ['id'],
  'alarm.dismiss': [],
  'sharp_alarm.set_enabled': ['enabled'],
  'clock.sync': ['confirm'],
  'clock.reset': ['confirm'],
  button: ['button', 'gesture'],
  'diagnostic.button': ['button', 'confirm'],
};
function integer(n, min, max) {
  return Number.isInteger(n) && n >= min && n <= max;
}
function validateCommand(command, state) {
  if (!command || typeof command !== 'object' || Array.isArray(command))
    throw fail('invalid_command');
  const keys = ACTIONS[command.action];
  if (
    !keys ||
    typeof command.requestId !== 'string' ||
    !/^[a-zA-Z0-9._:-]{1,96}$/.test(command.requestId) ||
    Object.keys(command).some(
      (k) => !['action', 'requestId', ...keys].includes(k),
    )
  )
    throw fail('invalid_command');
  const action = command.action;
  if (keys.includes('enabled') && typeof command.enabled !== 'boolean')
    throw fail('invalid_enabled');
  if (
    keys.includes('id') &&
    (action !== 'alarm.upsert' || command.id !== undefined) &&
    !integer(command.id, 1, 0xffffffff)
  )
    throw fail('invalid_id');
  if (
    ['clock.sync', 'clock.reset', 'diagnostic.button'].includes(action) &&
    command.confirm !== true
  )
    throw fail('confirmation_required');
  if (
    action === 'button' &&
    (!['onoff', 'snooze'].includes(command.button) ||
      command.gesture !== 'click')
  )
    throw fail('unsupported_button');
  if (
    action === 'diagnostic.button' &&
    !['time', 'hour', 'minute', 'alarm', 'snooze', 'onoff'].includes(
      command.button,
    )
  )
    throw fail('unsupported_button');
  if (action === 'timer.create' && !integer(command.minutes, 1, 1439))
    throw fail('invalid_timer_minutes');
  if (action === 'alarm.upsert') {
    if (
      typeof command.recurring !== 'boolean' ||
      !integer(command.hour, 0, 23) ||
      !integer(command.minute, 0, 59)
    )
      throw fail('invalid_alarm_time');
    if (command.recurring) {
      if (!integer(command.weekdayMask, 1, 127) || command.epoch !== undefined)
        throw fail('invalid_weekdays');
    } else {
      if (
        !integer(command.epoch, 1, 0xffffffff) ||
        command.weekdayMask !== undefined
      )
        throw fail('invalid_alarm_epoch');
      const time = DateTime.fromSeconds(command.epoch, {
        zone: 'America/Chicago',
      });
      if (time.hour !== command.hour || time.minute !== command.minute)
        throw fail('epoch_time_mismatch');
      if (command.enabled && state?.timeValid && command.epoch <= state.epoch)
        throw fail('alarm_time_in_past');
    }
  }
  if (state) {
    const collection =
      action.startsWith('alarm.') && keys.includes('id')
        ? state.alarms
        : action.startsWith('timer.') && keys.includes('id')
          ? state.timers
          : null;
    if (
      collection &&
      command.id !== undefined &&
      !collection.some((item) => item.id === command.id)
    )
      throw fail('entry_not_found', 404);
    if (
      collection === state.alarms &&
      command.id !== undefined &&
      state.alarms.some(
        (item) =>
          item.id === command.id && /physical|manual/i.test(item.origin),
      )
    )
      throw fail('manual_alarm_read_only');
    if (
      action === 'alarm.upsert' &&
      command.id === undefined &&
      state.alarms.length >= 10
    )
      throw fail('alarm_capacity', 409);
    if (action === 'timer.create' && state.timers.length >= 5)
      throw fail('timer_capacity', 409);
  }
  return { ...command };
}
function validState(value) {
  const bools = [
    'masterEnabled',
    'sharpAlarmGateEnabled',
    'sharpAlarmOutputEnabled',
    'timeValid',
    'wifiConnected',
    'mqttConnected',
    'sharpBusy',
    'ringing',
    'ringingInferred',
  ];
  return !!(
    value &&
    value.apiVersion === 2 &&
    value.deviceId === 'smart-clock' &&
    bools.every((key) => typeof value[key] === 'boolean') &&
    ['smart', 'manual_fallback'].includes(value.controlMode) &&
    typeof value.timeStatus === 'string' &&
    integer(value.epoch, 0, 0xffffffff) &&
    Array.isArray(value.alarms) &&
    value.alarms.length <= 10 &&
    value.alarms.every(
      (a) =>
        a &&
        integer(a.id, 1, 0xffffffff) &&
        typeof a.enabled === 'boolean' &&
        typeof a.recurring === 'boolean' &&
        integer(a.hour, 0, 23) &&
        integer(a.minute, 0, 59) &&
        typeof a.state === 'string',
    ) &&
    new Set(value.alarms.map((a) => a.id)).size === value.alarms.length &&
    Array.isArray(value.timers) &&
    value.timers.length <= 5 &&
    value.timers.every(
      (t) =>
        t &&
        integer(t.id, 1, 0xffffffff) &&
        typeof t.enabled === 'boolean' &&
        integer(t.targetEpoch, 0, 0xffffffff) &&
        typeof t.state === 'string',
    ) &&
    new Set(value.timers.map((t) => t.id)).size === value.timers.length &&
    (!value.next ||
      (integer(value.next.id, 1, 0xffffffff) &&
        typeof value.next.type === 'string' &&
        integer(value.next.epoch, 1, 0xffffffff)))
  );
}
function projectState(value) {
  const pick = (object, keys) =>
    Object.fromEntries(
      keys
        .filter((key) => object[key] !== undefined)
        .map((key) => [key, object[key]]),
    );
  const result = pick(value, [
    'apiVersion',
    'deviceId',
    'masterEnabled',
    'sharpAlarmGateEnabled',
    'sharpAlarmOutputEnabled',
    'controlMode',
    'timeValid',
    'timeStatus',
    'epoch',
    'wifiConnected',
    'mqttConnected',
    'sharpBusy',
    'ringing',
    'ringingInferred',
  ]);
  if (typeof value.lastSharpError === 'string')
    result.lastSharpError = value.lastSharpError.slice(0, 200);
  if (value.next) result.next = pick(value.next, ['id', 'type', 'epoch']);
  result.alarms = value.alarms.map((a) =>
    pick(a, [
      'id',
      'enabled',
      'recurring',
      'temporary',
      'hour',
      'minute',
      'weekdayMask',
      'epoch',
      'origin',
      'state',
    ]),
  );
  result.timers = value.timers.map((t) =>
    pick(t, [
      'id',
      'enabled',
      'targetEpoch',
      'pausedRemainingSeconds',
      'state',
    ]),
  );
  return result;
}
class ClockService {
  constructor() {
    this.client = null;
    this.state = null;
    this.connected = false;
    this.online = false;
    this.fresh = false;
    this.updatedAt = null;
    this.pending = new Map();
    this.recent = new Map();
    this.error = 'not_configured';
    this.archive = new RuntimeStore('clock-history.json', []);
  }
  initialize() {
    try {
      const config = mqttConfig();
      this.client = mqtt.connect(config.url, {
        ...config.options,
        clientId: `nexus-clock-${process.pid}`,
      });
      this.client.on('connect', () => {
        this.connected = true;
        this.online = false;
        this.fresh = false;
        this.error = null;
        this.client.subscribe(
          ['status', 'state', 'event', 'response'].map((t) => `${PREFIX}/${t}`),
        );
        this.emit();
      });
      this.client.on('message', (topic, data) => this.receive(topic, data));
      this.client.on('offline', () => this.disconnect());
      this.client.on('close', () => this.disconnect());
      this.client.on('error', () => {
        this.error = 'mqtt_connection_error';
        this.emit();
      });
    } catch (error) {
      this.error = error.code || 'mqtt_configuration_error';
      logger.warn('Clock MQTT unavailable', { code: this.error });
    }
  }
  getState() {
    return {
      deviceId: 'smart-clock',
      brokerConnected: this.connected,
      online: this.connected && this.online,
      fresh: this.fresh,
      updatedAt: this.updatedAt,
      error: this.error,
      state: this.state,
    };
  }
  emit() {
    events.emit('clock_state', this.getState());
  }
  history() {
    return this.archive.read().slice(0, 10);
  }
  receive(topic, data) {
    try {
      if (!topic.startsWith(`${PREFIX}/`) || data.length > 65536) return;
      const kind = topic.slice(PREFIX.length + 1);
      if (kind === 'status') {
        let text = data.toString().trim();
        if (text.startsWith('{')) {
          const status = JSON.parse(text);
          if (status.deviceId && status.deviceId !== 'smart-clock') return;
          text = typeof status.online === 'boolean' ? (status.online ? 'online' : 'offline') : status.status;
        }
        if (!['online', 'offline'].includes(text)) return;
        const changed = this.online !== (text === 'online');
        this.online = text === 'online';
        if (!this.online) {
          this.fresh = false;
          this.rejectPending('device_offline');
        }
        if (changed)
          activity.record(
            'smart-clock',
            this.online ? 'Clock connected' : 'Clock disconnected',
          );
        this.emit();
        return;
      }
      const payload = JSON.parse(data.toString());
      if (kind === 'state') {
        if (!validState(payload)) {
          this.error = 'incompatible_clock_state';
          this.fresh = false;
          this.emit();
          return;
        }
        this.state = projectState(payload);
        this.updatedAt = Date.now();
        this.fresh = true;
        this.error = null;
        const expired = this.state.alarms.filter(
          (a) =>
            !a.recurring &&
            !/physical|manual/i.test(a.origin) &&
            ['fired', 'suppressed'].includes(a.state) &&
            a.epoch <= payload.epoch,
        );
        if (expired.length) {
          const history = this.history();
          expired.forEach((a) => {
            if (!history.some((h) => h.id === a.id && h.epoch === a.epoch))
              history.unshift({
                ...a,
                deviceId: 'smart-clock',
                observedAt: Date.now(),
              });
          });
          this.archive.write(
            history.sort((a, b) => b.epoch - a.epoch).slice(0, 10),
          );
        }
        this.emit();
      } else if (kind === 'response') {
        const pending = this.pending.get(payload.requestId);
        if (!pending || typeof payload.ok !== 'boolean') return;
        clearTimeout(pending.timer);
        this.pending.delete(payload.requestId);
        this.remember(payload.requestId, payload);
        if (payload.ok) pending.resolve(payload);
        else
          pending.reject(
            fail(
              typeof payload.error === 'string'
                ? payload.error
                : 'device_rejected',
              409,
            ),
          );
        activity.record(
          'smart-clock',
          `${pending.action}: ${payload.ok ? 'acknowledged' : 'rejected'}`,
          payload.ok ? 'info' : 'error',
        );
      } else if (
        kind === 'event' &&
        payload &&
        typeof payload.type === 'string'
      ) {
        if (['alarm.fired', 'alarm.suppressed'].includes(payload.type)) {
          const id = Number(payload.id ?? payload.alarmId ?? payload.payload?.id);
          const alarm = this.state?.alarms.find(a => a.id === id && !a.recurring && !/physical|manual/i.test(a.origin));
          if (alarm && Number.isFinite(alarm.epoch)) {
            const previous = this.history().filter(a => !(a.id === alarm.id && a.epoch === alarm.epoch));
            this.archive.write([{ ...alarm, state: payload.type.slice(6), deviceId: 'smart-clock', observedAt: Date.now() }, ...previous].sort((a, b) => b.epoch - a.epoch).slice(0, 10));
          }
        }
        events.emit('clock_event', {
          type: payload.type.slice(0, 100),
          receivedAt: Date.now(),
        });
      }
    } catch (_) {
      logger.warn('Invalid clock MQTT payload');
    }
  }
  remember(id, value) {
    this.recent.set(id, value);
    if (this.recent.size > 100)
      this.recent.delete(this.recent.keys().next().value);
  }
  async command(input) {
    const command = validateCommand(input, this.state);
    if (!this.connected || !this.online) throw fail('device_offline', 503);
    if (!this.fresh || !this.state) throw fail('awaiting_snapshot', 503);
    if (!this.state.mqttConnected || !this.state.wifiConnected)
      throw fail('awaiting_snapshot', 503);
    if (this.state.sharpBusy) throw fail('busy', 409);
    if (
      this.pending.has(command.requestId) ||
      this.recent.has(command.requestId)
    )
      throw fail('duplicate_request_id', 409);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(command.requestId);
        this.remember(command.requestId, null);
        reject(fail('command_timeout_unknown_outcome', 504));
      }, 10000);
      this.pending.set(command.requestId, {
        resolve,
        reject,
        timer,
        action: command.action,
      });
      this.client.publish(
        `${PREFIX}/command`,
        JSON.stringify(command),
        { qos: 0, retain: false },
        (error) => {
          if (error && this.pending.has(command.requestId)) {
            clearTimeout(timer);
            this.pending.delete(command.requestId);
            this.remember(command.requestId, null);
            reject(fail('publish_failed', 503));
          }
        },
      );
    });
  }
  rejectPending(code) {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      this.remember(id, null);
      p.reject(fail(code, 503));
    }
    this.pending.clear();
  }
  disconnect() {
    this.connected = false;
    this.online = false;
    this.fresh = false;
    this.rejectPending('device_offline');
    this.emit();
  }
  close() {
    this.disconnect();
    this.client?.end(true);
    this.client = null;
  }
}
module.exports = new ClockService();
module.exports.ClockService = ClockService;
module.exports.validateCommand = validateCommand;
module.exports.validState = validState;
