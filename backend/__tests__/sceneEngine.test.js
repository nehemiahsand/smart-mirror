const DEFAULT_SETTINGS = {
  display: {
    standbyMode: false,
  },
  camera: {
    enabled: true,
  },
  presence: {
    enabled: true,
    standbyOnIdle: true,
    idleTimeoutSeconds: 300,
    wakeOnMotion: true,
    wakeSuppressionSeconds: 8,
  },
  sceneConfig: {},
  sceneSchedule: [],
  scenes: {
    day: {
      id: 'day',
      name: 'Day',
      layout: 'default',
      modules: [],
    },
    standby: {
      id: 'standby',
      name: 'Standby',
      layout: 'standby',
      modules: [],
    },
  },
  current_scene: 'day',
  current_page: 'home',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getPath(target, path) {
  return String(path || '').split('.').reduce((value, key) => (
    value && typeof value === 'object' ? value[key] : undefined
  ), target);
}

function setPath(target, path, value) {
  const keys = String(path || '').split('.');
  let current = target;

  for (let i = 0; i < keys.length - 1; i += 1) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
}

function createSceneEngineTestContext(overrides = {}) {
  jest.resetModules();

  const settingsData = clone(DEFAULT_SETTINGS);
  for (const [path, value] of Object.entries(overrides)) {
    setPath(settingsData, path, value);
  }

  const settingsService = {
    get: jest.fn((path) => getPath(settingsData, path)),
    getAll: jest.fn(() => settingsData),
    update: jest.fn(async (path, value) => {
      setPath(settingsData, path, value);
      return settingsData;
    }),
    updateMultiple: jest.fn(async (updates) => {
      Object.entries(updates).forEach(([path, value]) => setPath(settingsData, path, value));
      return settingsData;
    }),
  };

  const websocketServer = {
    broadcast: jest.fn(),
    broadcastPageChange: jest.fn(),
    broadcastPageAlias: jest.fn(),
    broadcastSceneChange: jest.fn(),
    broadcastSettingsUpdate: jest.fn(),
  };

  const consoleService = {
    getState: jest.fn(() => ({
      activePageId: 'dynamic',
      pageId: 'home',
    })),
    openPage: jest.fn(async () => ({})),
    handleEsp32Event: jest.fn(async () => ({})),
    isStatsOverlayActive: jest.fn(() => false),
  };

  const displayService = {
    turnOff: jest.fn(async () => ({ success: true })),
    turnOn: jest.fn(async () => ({ success: true })),
  };

  const cameraService = {
    setCameraEnabled: jest.fn(async () => ({})),
    startShutdownTimer: jest.fn(),
    cancelShutdownTimer: jest.fn(),
  };

  jest.doMock('../src/services/settings', () => settingsService);
  jest.doMock('../src/api/websocket', () => websocketServer);
  jest.doMock('../src/services/console', () => consoleService);
  jest.doMock('../src/services/display', () => displayService);
  jest.doMock('../src/services/camera', () => cameraService);
  jest.doMock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));

  const sceneEngine = require('../src/services/sceneEngine');
  sceneEngine.initialized = true;

  return {
    sceneEngine,
    settingsData,
    settingsService,
    websocketServer,
    consoleService,
    displayService,
    cameraService,
  };
}

describe('SceneEngine button-driven standby handling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cycles pages on a short display.page.toggle press while awake', async () => {
    const { sceneEngine, consoleService, websocketServer } = createSceneEngineTestContext();

    await sceneEngine.handleEsp32Event({
      type: 'display.page.toggle',
      deviceId: 'mirror-entry-1',
      timestamp: Date.now(),
      payload: {
        hold: false,
      },
    });

    expect(consoleService.openPage).toHaveBeenCalledWith('weather', 'esp32_toggle');
    expect(websocketServer.broadcastPageChange).toHaveBeenCalledWith('weather', { source: 'esp32_toggle' });
  });

  it('enters standby on a held display.page.toggle press while awake', async () => {
    const { sceneEngine, settingsData, displayService, consoleService, cameraService } = createSceneEngineTestContext();

    await sceneEngine.handleEsp32Event({
      type: 'display.page.toggle',
      deviceId: 'mirror-entry-1',
      timestamp: Date.now(),
      payload: {
        hold: true,
      },
    });

    expect(settingsData.display.standbyMode).toBe(true);
    expect(displayService.turnOff).toHaveBeenCalledTimes(1);
    expect(cameraService.setCameraEnabled).not.toHaveBeenCalled();
    expect(consoleService.openPage).not.toHaveBeenCalled();
  });

  it('wakes from standby on a short display.page.toggle press', async () => {
    const { sceneEngine, settingsData, displayService, cameraService } = createSceneEngineTestContext();

    await sceneEngine.applyStandbyMode(true, 'test:standby');
    expect(settingsData.display.standbyMode).toBe(true);

    await sceneEngine.handleEsp32Event({
      type: 'display.page.toggle',
      deviceId: 'mirror-entry-1',
      timestamp: Date.now(),
      payload: {
        hold: false,
      },
    });

    expect(settingsData.display.standbyMode).toBe(false);
    expect(displayService.turnOn).toHaveBeenCalledTimes(1);
    expect(cameraService.setCameraEnabled).not.toHaveBeenCalled();
  });

  it('wakes from standby on a held display.page.toggle press', async () => {
    const { sceneEngine, settingsData, displayService, cameraService } = createSceneEngineTestContext();

    await sceneEngine.applyStandbyMode(true, 'test:standby');
    expect(settingsData.display.standbyMode).toBe(true);

    await sceneEngine.handleEsp32Event({
      type: 'display.page.toggle',
      deviceId: 'mirror-entry-1',
      timestamp: Date.now(),
      payload: {
        hold: true,
      },
    });

    expect(settingsData.display.standbyMode).toBe(false);
    expect(displayService.turnOn).toHaveBeenCalledTimes(1);
    expect(cameraService.setCameraEnabled).not.toHaveBeenCalled();
  });

  it('ignores a short display.page.toggle press while the stats overlay is open', async () => {
    const { sceneEngine, settingsData, consoleService } = createSceneEngineTestContext();
    consoleService.isStatsOverlayActive.mockReturnValue(true);

    await sceneEngine.handleEsp32Event({
      type: 'display.page.toggle',
      deviceId: 'mirror-entry-1',
      timestamp: Date.now(),
      payload: {
        hold: false,
      },
    });

    expect(settingsData.display.standbyMode).toBe(false);
    expect(consoleService.openPage).not.toHaveBeenCalled();
  });

  it('enters standby on a held display.page.toggle press while the stats overlay is open', async () => {
    const { sceneEngine, settingsData, displayService, consoleService, cameraService } = createSceneEngineTestContext();
    consoleService.isStatsOverlayActive.mockReturnValue(true);

    await sceneEngine.handleEsp32Event({
      type: 'display.page.toggle',
      deviceId: 'mirror-entry-1',
      timestamp: Date.now(),
      payload: {
        hold: true,
      },
    });

    expect(settingsData.display.standbyMode).toBe(true);
    expect(displayService.turnOff).toHaveBeenCalledTimes(1);
    expect(cameraService.setCameraEnabled).not.toHaveBeenCalled();
    expect(consoleService.openPage).not.toHaveBeenCalled();
  });
});
