jest.mock('../src/services/activity', () => ({ record: jest.fn() }));
jest.mock('../src/services/nexusConfig', () => ({
  save: jest.fn(),
  get: jest.fn(() => ({
    devices: [
      {
        id: 'desk',
        name: 'Desk',
        kind: 'wled',
        address: 'http://192.168.1.50',
      },
      {
        id: 'monitor',
        name: 'Monitor',
        kind: 'wled',
        address: 'http://192.168.1.51',
      },
    ],
    groupPresets: [{ name: 'Pair', devices: { desk: 3, monitor: 7 } }],
  })),
}));
const { LightsService } = require('../src/services/lights');
describe('WLED state and commands', () => {
  let service;
  beforeEach(() => {
    service = new LightsService();
    for (const id of ['desk', 'monitor'])
      service.states.set(id, {
        online: true,
        info: {},
        state: { on: false, bri: 120, seg: [{ id: 0, start: 0, stop: 10 }] },
      });
    service.request = jest.fn(async () => ({
      on: false,
      bri: 150,
      seg: [{ id: 0, start: 0, stop: 10 }],
    }));
  });
  it('preserves off state when brightness or color changes', async () => {
    await service.command('desk', { brightness: 50 });
    expect(service.request.mock.calls[0][2]).toMatchObject({
      on: false,
      bri: 128,
    });
    await service.command('desk', { color: '#00ffaa' });
    expect(service.request.mock.calls[1][2]).toMatchObject({
      on: false,
      seg: [{ id: 0, col: [[0, 255, 170, 0]], fx: 0 }],
    });
  });
  it('seeds Rainbow / Gaming by name with explicit board mappings only once', () => {
    const marker = { version: 0 }; service.defaultPairs = { read: () => marker, write: (value) => Object.assign(marker, value) };
    for (const id of ['desk', 'monitor']) service.states.get(id).presets = Object.fromEntries(['daytime', 'Star Wars', id === 'desk' ? 'Rainbow (bright)' : 'gaming', 'GSW', 'AUBURN', id === 'desk' ? 'Rainbow' : 'soft night'].map((n, i) => [i + 1, { n }]));
    const config = require('../src/services/nexusConfig');
    config.save.mockClear(); service.seedPairs();
    expect(config.save.mock.calls[0][0].groupPresets).toContainEqual({ name: 'Rainbow / Gaming', devices: { desk: 6, monitor: 3 } });
    service.seedPairs(); expect(config.save).toHaveBeenCalledTimes(1); expect(service.request).not.toHaveBeenCalled();
  });
  it('uses explicit per-device paired presets', async () => {
    await service.group({ groupPreset: 'Pair' });
    expect(service.request.mock.calls.map((call) => call[2].ps)).toEqual([
      3, 7,
    ]);
  });
  it('reports partial failure and never rolls back or replays', async () => {
    service.request.mockImplementation(async (device) => {
      if (device.id === 'monitor') throw new Error('offline');
      return { on: true, bri: 120 };
    });
    const result = await service.group({ on: true });
    expect(result.ok).toBe(false);
    expect(result.results.map((r) => r.ok)).toEqual([true, false]);
    expect(service.request).toHaveBeenCalledTimes(2);
  });
  it('ignores a poll response after connection settings change', async () => {
    let complete;
    service.request.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const poll = service.refresh(service.devices()[0]);
    service.generation++;
    service.states.clear();
    complete({ state: { on: true, bri: 200 } });
    await poll;
    expect(service.states.size).toBe(0);
  });
  it('rejects malformed ranges and arbitrary payloads before making network calls', async () => {
    for (const command of [
      { brightness: -1 },
      { color: 'red' },
      { presetId: 251 },
      { url: 'http://other' },
    ])
      await expect(service.command('desk', command)).rejects.toThrow();
    expect(service.request).not.toHaveBeenCalled();
  });
});
