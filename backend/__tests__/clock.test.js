const fs = require('fs');
const os = require('os');
const path = require('path');
jest.mock('../src/services/activity', () => ({ record: jest.fn() }));
const {
  ClockService,
  validateCommand,
  validState,
} = require('../src/services/clock');

function snapshot(overrides = {}) {
  return {
    apiVersion: 2,
    deviceId: 'smart-clock',
    masterEnabled: true,
    sharpAlarmGateEnabled: true,
    sharpAlarmOutputEnabled: true,
    controlMode: 'smart',
    timeValid: true,
    timeStatus: 'synchronized',
    epoch: 1792512000,
    wifiConnected: true,
    mqttConnected: true,
    sharpBusy: false,
    ringing: false,
    ringingInferred: true,
    alarms: [],
    timers: [],
    ...overrides,
  };
}
describe('Authoritative clock integration', () => {
  let service;
  let directory;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-clock-'));
    process.env.NEXUS_DATA_DIR = directory;
    service = new ClockService();
    service.connected = true;
    service.online = true;
    service.fresh = true;
    service.state = snapshot();
    service.client = {
      publish: jest.fn((topic, payload, options, callback) => callback()),
      end: jest.fn(),
    };
    jest.useFakeTimers();
  });
  afterEach(() => {
    service.close();
    jest.useRealTimers();
    fs.rmSync(directory, { recursive: true, force: true });
    delete process.env.NEXUS_DATA_DIR;
  });
  it.each([0, 1440, 1.5, '20'])('rejects invalid timer minutes %s', (minutes) =>
    expect(() =>
      validateCommand({ requestId: 'one', action: 'timer.create', minutes }),
    ).toThrow(),
  );
  it('rejects holds, raw controls without confirmation, and invalid weekday masks', () => {
    expect(() =>
      validateCommand({
        requestId: 'a',
        action: 'button',
        button: 'snooze',
        gesture: 'hold',
      }),
    ).toThrow();
    expect(() =>
      validateCommand({
        requestId: 'b',
        action: 'diagnostic.button',
        button: 'hour',
      }),
    ).toThrow();
    expect(() =>
      validateCommand({
        requestId: 'c',
        action: 'alarm.upsert',
        hour: 7,
        minute: 0,
        enabled: true,
        recurring: true,
        weekdayMask: 0,
      }),
    ).toThrow();
  });
  it('rejects mismatched one-time local time/epoch', () =>
    expect(() =>
      validateCommand({
        requestId: 'x',
        action: 'alarm.upsert',
        hour: 7,
        minute: 0,
        enabled: true,
        recurring: false,
        epoch: 1792512000,
      }),
    ).toThrow('epoch_time_mismatch'));
  it('publishes only a non-retained correlated command and waits for the response', async () => {
    const promise = service.command({
      requestId: 'one',
      action: 'timer.create',
      minutes: 20,
    });
    expect(service.client.publish.mock.calls[0][0]).toBe(
      'smartmirror/esp32/smart-clock/command',
    );
    expect(service.client.publish.mock.calls[0][2]).toEqual({
      qos: 0,
      retain: false,
    });
    service.receive(
      'smartmirror/esp32/smart-clock/response',
      Buffer.from(JSON.stringify({ ok: true, requestId: 'unrelated' })),
    );
    expect(service.pending.size).toBe(1);
    service.receive(
      'smartmirror/esp32/smart-clock/response',
      Buffer.from(JSON.stringify({ ok: true, requestId: 'one' })),
    );
    await expect(promise).resolves.toMatchObject({ ok: true });
    expect(service.state.timers).toEqual([]);
    await expect(
      service.command({
        requestId: 'one',
        action: 'timer.create',
        minutes: 20,
      }),
    ).rejects.toThrow('duplicate_request_id');
  });
  it('reports timeout as unknown and does not replay on a late response', async () => {
    const pending = service.command({
      requestId: 'timeout',
      action: 'timer.create',
      minutes: 2,
    });
    const assertion = expect(pending).rejects.toThrow(
      'command_timeout_unknown_outcome',
    );
    jest.advanceTimersByTime(10001);
    await assertion;
    service.receive(
      'smartmirror/esp32/smart-clock/response',
      Buffer.from('{"ok":true,"requestId":"timeout"}'),
    );
    expect(service.client.publish).toHaveBeenCalledTimes(1);
  });
  it('requires a reconnect snapshot and rejects busy/offline controls', async () => {
    service.disconnect();
    await expect(
      service.command({ requestId: 'x', action: 'alarm.dismiss' }),
    ).rejects.toThrow('device_offline');
    service.connected = true;
    service.online = true;
    await expect(
      service.command({ requestId: 'x', action: 'alarm.dismiss' }),
    ).rejects.toThrow('awaiting_snapshot');
    service.receive(
      'smartmirror/esp32/smart-clock/state',
      Buffer.from(JSON.stringify(snapshot({ sharpBusy: true }))),
    );
    await expect(
      service.command({ requestId: 'x', action: 'alarm.dismiss' }),
    ).rejects.toThrow('busy');
  });
  it('validates snapshot version and preserves previous state on malformed messages', () => {
    expect(validState(snapshot({ apiVersion: 1 }))).toBe(false);
    const original = service.state;
    service.receive(
      'smartmirror/esp32/smart-clock/state',
      Buffer.from('{"apiVersion":1}'),
    );
    expect(service.state).toBe(original);
    expect(service.fresh).toBe(false);
  });
  it('archives observed expired smart alarms once, excluding manual and future disabled entries', () => {
    const alarm = {
      id: 1,
      enabled: false,
      recurring: false,
      hour: 7,
      minute: 0,
      epoch: 100,
      origin: 'pwa',
      state: 'fired',
    };
    const state = snapshot({
      alarms: [
        alarm,
        { ...alarm, id: 2, origin: 'physical' },
        { ...alarm, id: 3, state: 'disabled', epoch: 2000000000 },
      ],
    });
    for (let i = 0; i < 2; i++)
      service.receive(
        'smartmirror/esp32/smart-clock/state',
        Buffer.from(JSON.stringify(state)),
      );
    expect(service.history()).toHaveLength(1);
    expect(service.history()[0].id).toBe(1);
  });
  it('surfaces firmware busy rejection without queuing', async () => {
    const pending = service.command({
      requestId: 'busy',
      action: 'master.set',
      enabled: false,
    });
    service.receive(
      'smartmirror/esp32/smart-clock/response',
      Buffer.from('{"ok":false,"requestId":"busy","error":"busy"}'),
    );
    await expect(pending).rejects.toThrow('busy');
    expect(service.pending.size).toBe(0);
  });
  it('archives explicit firing events before a temporary entry disappears', () => {
    service.state.alarms = [{ id: 9, enabled: true, recurring: false, hour: 7, minute: 0, epoch: 100, origin: 'pwa', state: 'scheduled' }];
    service.receive('smartmirror/esp32/smart-clock/event', Buffer.from('{"type":"alarm.fired","payload":{"id":9}}'));
    expect(service.history()[0]).toMatchObject({ id: 9, state: 'fired' });
  });
  it('projects only the v2 public state fields into browser snapshots', () => {
    service.receive('smartmirror/esp32/smart-clock/state', Buffer.from(JSON.stringify(snapshot({ mqttPassword: 'must-not-leave-device', caPath: '/private/ca.pem' }))));
    expect(service.getState().state).not.toHaveProperty('mqttPassword');
    expect(service.getState().state).not.toHaveProperty('caPath');
  });
});
