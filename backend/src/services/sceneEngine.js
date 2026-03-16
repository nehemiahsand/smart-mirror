const logger = require('../utils/logger');
const consoleService = require('./console');
const settingsService = require('./settings');

const DISPLAY_PAGE_ORDER = ['home', 'fun', 'spotify'];

function parseClockValue(value) {
  if (typeof value !== 'string' || !value.includes(':')) {
    return null;
  }

  const [hoursText, minutesText] = value.split(':');
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function getMinutesSinceMidnight(date) {
  return (date.getHours() * 60) + date.getMinutes();
}

function isScheduleMatch(scheduleEntry, now) {
  if (!scheduleEntry || scheduleEntry.enabled === false) {
    return false;
  }

  if (Array.isArray(scheduleEntry.days) && scheduleEntry.days.length > 0 && !scheduleEntry.days.includes(now.getDay())) {
    return false;
  }

  const start = parseClockValue(scheduleEntry.start);
  const end = parseClockValue(scheduleEntry.end);
  if (start == null || end == null) {
    return false;
  }

  const current = getMinutesSinceMidnight(now);
  if (start === end) {
    return true;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class SceneEngine {
  constructor() {
    this.initialized = false;
    this.tickInterval = null;
    this.manualOverride = null;
    this.lastMotionAt = null;
    this.motionActive = false;
    this.lastInputEvent = null;
    this.state = {
      activeSceneId: 'day',
      activeScene: null,
      pageAlias: 'home',
      source: 'schedule',
      reason: 'initial',
      isStandby: false,
      presence: 'idle',
      lastMotionAt: null,
      overrideExpiresAt: null,
      lastInputEvent: null,
      updatedAt: Date.now(),
    };
  }

  initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.refreshState({ source: 'initialize', reason: 'startup', broadcast: false, persist: true });
    this.tickInterval = setInterval(() => {
      this.tick().catch((error) => {
        logger.error('Scene engine tick failed', { error: error.message });
      });
    }, 2000);
    logger.info('Scene engine initialized');
  }

  isInitialized() {
    return this.initialized;
  }

  close() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  shutdown() {
    this.close();
  }

  getScenes() {
    const configuredScenes = settingsService.get('scenes') || {};
    const filteredScenes = Object.fromEntries(
      Object.entries(configuredScenes).filter(([sceneId]) => sceneId !== 'media')
    );
    const standbyScene = configuredScenes.standby || {
      id: 'standby',
      name: 'Standby',
      layout: 'standby',
      modules: []
    };

    return {
      ...filteredScenes,
      standby: standbyScene,
    };
  }

  getScene(sceneId) {
    return this.getScenes()[sceneId] || null;
  }

  getSchedulableSceneIds() {
    return Object.values(this.getScenes())
      .filter((scene) => scene && scene.id !== 'standby')
      .map((scene) => scene.id);
  }

  getDefaultSceneId() {
    return settingsService.get('sceneConfig.defaultSceneId') || this.getSchedulableSceneIds()[0] || 'day';
  }

  getOverrideDurationMs() {
    const seconds = Number(settingsService.get('sceneConfig.manualOverrideDurationSeconds'));
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 900000;
  }

  getIdleTimeoutMs() {
    const seconds = Number(settingsService.get('presence.idleTimeoutSeconds'));
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 900000;
  }

  getPageAlias(sceneId) {
    return 'home';
  }

  getState() {
    return clone(this.state);
  }

  getScheduleMatch(now = new Date()) {
    const schedule = settingsService.get('sceneSchedule') || [];
    const matched = schedule.find((entry) => isScheduleMatch(entry, now) && this.getScene(entry.sceneId));
    if (matched) {
      return matched.sceneId;
    }
    return this.getDefaultSceneId();
  }

  getNextSceneId(direction = 1) {
    const sceneIds = this.getSchedulableSceneIds();
    if (sceneIds.length === 0) {
      return this.getDefaultSceneId();
    }

    const currentId = this.state.activeSceneId === 'standby'
      ? this.getScheduleMatch(new Date())
      : this.state.activeSceneId;
    const currentIndex = Math.max(sceneIds.indexOf(currentId), 0);
    const nextIndex = (currentIndex + direction + sceneIds.length) % sceneIds.length;
    return sceneIds[nextIndex];
  }

  computePresence(now = Date.now()) {
    if (!settingsService.get('presence.enabled')) {
      return 'disabled';
    }

    if (!this.lastMotionAt) {
      return 'idle';
    }

    return (now - this.lastMotionAt) < this.getIdleTimeoutMs() ? 'present' : 'idle';
  }

  resolveScene(now = new Date()) {
    const standbyMode = settingsService.get('display.standbyMode') === true;
    const presence = this.computePresence(now.getTime());

    if (
      this.manualOverride &&
      Number.isFinite(this.manualOverride.expiresAt) &&
      this.manualOverride.expiresAt <= now.getTime()
    ) {
      this.manualOverride = null;
    }

    if (standbyMode) {
      return {
        activeSceneId: 'standby',
        activeScene: this.getScene('standby'),
        source: 'standby',
        reason: 'display.standbyMode',
        isStandby: true,
        pageAlias: 'home',
        presence,
        overrideExpiresAt: null,
      };
    }

    if (this.manualOverride && this.getScene(this.manualOverride.sceneId)) {
      return {
        activeSceneId: this.manualOverride.sceneId,
        activeScene: this.getScene(this.manualOverride.sceneId),
        source: this.manualOverride.source,
        reason: 'manual_override',
        isStandby: false,
        pageAlias: this.getPageAlias(this.manualOverride.sceneId),
        presence,
        overrideExpiresAt: this.manualOverride.expiresAt,
      };
    }

    const scheduledSceneId = this.getScheduleMatch(now);
    return {
      activeSceneId: scheduledSceneId,
      activeScene: this.getScene(scheduledSceneId),
      source: 'schedule',
      reason: 'schedule_match',
      isStandby: false,
      pageAlias: this.getPageAlias(scheduledSceneId),
      presence,
      overrideExpiresAt: null,
    };
  }

  async persistIdentity(sceneState) {
    await settingsService.updateMultiple({
      current_scene: sceneState.activeSceneId,
      current_page: sceneState.pageAlias,
    });
  }

  broadcastSceneState() {
    const websocketServer = require('../api/websocket');
    websocketServer.broadcastSceneChange(this.getState());
    websocketServer.broadcastPageAlias(this.state.pageAlias, { source: 'scene_engine', persist: false });
  }

  async refreshState({ source = 'system', reason = 'refresh', broadcast = true, persist = false } = {}) {
    const previousSceneId = this.state.activeSceneId;
    const previousPageAlias = this.state.pageAlias;
    const resolved = this.resolveScene(new Date());

    this.state = {
      ...this.state,
      ...resolved,
      console: consoleService.getState(),
      lastMotionAt: this.lastMotionAt,
      motionActive: this.motionActive,
      lastInputEvent: this.lastInputEvent,
      updatedAt: Date.now(),
      source,
      reason,
    };

    const changed = previousSceneId !== this.state.activeSceneId || previousPageAlias !== this.state.pageAlias;
    if (persist || changed) {
      this.persistIdentity(this.state).catch((error) => {
        logger.error('Failed to persist scene identity', {
          error: error.message,
          sceneId: this.state.activeSceneId,
          pageAlias: this.state.pageAlias,
        });
      });
    }

    if (broadcast && changed) {
      logger.info('Scene changed', {
        sceneId: this.state.activeSceneId,
        source,
        reason,
      });
      this.broadcastSceneState();
    } else if (broadcast) {
      const websocketServer = require('../api/websocket');
      websocketServer.broadcastSceneChange(this.getState());
    }

    return this.getState();
  }

  async applyStandbyMode(standbyMode, reason) {
    const currentStandbyMode = settingsService.get('display.standbyMode') === true;
    if (currentStandbyMode === standbyMode) {
      return this.refreshState({ source: 'scene_engine', reason, broadcast: true, persist: true });
    }

    const websocketServer = require('../api/websocket');
    const displayService = require('./display');
    const cameraService = require('./camera');

    const updatedSettings = await settingsService.updateMultiple({
      'display.standbyMode': standbyMode,
    });

    websocketServer.broadcastSettingsUpdate(updatedSettings);
    websocketServer.broadcast({
      type: 'standby_change',
      standby: standbyMode,
      timestamp: Date.now(),
    });

    try {
      if (standbyMode) {
        await cameraService.setCameraEnabled(false);
        await displayService.turnOff();
        if (typeof cameraService.startShutdownTimer === 'function') {
          cameraService.startShutdownTimer();
        }
      } else {
        if (settingsService.get('camera.enabled') !== false) {
          await cameraService.setCameraEnabled(true);
        }
        await displayService.turnOn();
        if (typeof cameraService.cancelShutdownTimer === 'function') {
          cameraService.cancelShutdownTimer();
        }
      }
    } catch (error) {
      logger.error('Failed to apply standby display state', {
        error: error.message,
        standbyMode,
      });
    }

    return this.refreshState({ source: 'scene_engine', reason, broadcast: true, persist: true });
  }

  async activateSceneOverride(sceneId, source = 'manual', durationMs = this.getOverrideDurationMs()) {
    if (!this.getScene(sceneId)) {
      throw new Error(`Unknown scene: ${sceneId}`);
    }

    this.manualOverride = {
      sceneId,
      source,
      expiresAt: durationMs > 0 ? Date.now() + durationMs : null,
    };

    if (settingsService.get('display.standbyMode') === true) {
      await this.applyStandbyMode(false, `override:${sceneId}`);
      return this.getState();
    }

    return this.refreshState({ source, reason: `override:${sceneId}`, broadcast: true, persist: true });
  }

  async activateScene(sceneId, source = 'manual', durationMs = this.getOverrideDurationMs()) {
    return this.activateSceneOverride(sceneId, source, durationMs);
  }

  async clearManualOverride(source = 'manual') {
    this.manualOverride = null;
    return this.refreshState({ source, reason: 'resume_auto', broadcast: true, persist: true });
  }

  async clearOverride(source = 'manual') {
    return this.clearManualOverride(source);
  }

  async handlePageRequest(page, context = {}) {
    if (page === 'spotify' || page === 'fun') {
      return this.getState();
    }
    if (page === 'home') {
      if (settingsService.get('display.standbyMode') === true) {
        await this.applyStandbyMode(false, `${context.source || 'legacy_page'}:wake`);
      }
      return this.clearManualOverride(context.source || 'legacy_page');
    }

    throw new Error('Invalid page change request');
  }

  async handleLegacyPageCommand(page, source = 'legacy_page') {
    if (source === 'display_sync') {
      return this.getState();
    }
    return this.handlePageRequest(page, { source });
  }

  async handleButtonAction(buttonId, pressType = 'press') {
    const buttonMappings = settingsService.get('inputMappings.buttons') || {};
    const mappingKey = pressType === 'long_press' ? `${buttonId}Long` : buttonId;
    const action = buttonMappings[mappingKey];

    if (!action) {
      logger.info('No button mapping configured', { buttonId, pressType });
      return this.getState();
    }

    switch (action) {
      case 'scene.next':
      case 'next_scene':
        return this.activateSceneOverride(this.getNextSceneId(1), 'button');
      case 'scene.previous':
      case 'previous_scene':
        return this.activateSceneOverride(this.getNextSceneId(-1), 'button');
      case 'scene.media':
      case 'toggle_media':
        return this.getState();
      case 'scene.resume_auto':
      case 'resume_auto':
        return this.clearManualOverride('button');
      case 'wake_display':
        return this.applyStandbyMode(false, 'button:wake_display');
      case 'standby_toggle':
        return this.applyStandbyMode(!(settingsService.get('display.standbyMode') === true), 'button:standby_toggle');
      default:
        logger.warn('Unhandled button action', { action, buttonId, pressType });
        return this.getState();
    }
  }

  async handleEsp32Event(event = {}) {
    const eventType = event.type;
    const payload = event.payload || {};
    const isStandby = settingsService.get('display.standbyMode') === true;
    this.lastInputEvent = {
      deviceId: event.deviceId || 'unknown',
      type: eventType,
      payload,
      timestamp: event.timestamp || Date.now(),
    };

    const websocketServer = require('../api/websocket');
    websocketServer.broadcast({
      type: 'input_event',
      data: this.lastInputEvent,
      timestamp: Date.now(),
    });

    if (eventType === 'motion.active') {
      this.motionActive = true;
      this.lastMotionAt = Date.now();
      if (settingsService.get('presence.wakeOnMotion') !== false && settingsService.get('display.standbyMode') === true) {
        return this.applyStandbyMode(false, 'motion.active');
      }
      return this.refreshState({ source: 'esp32', reason: 'motion.active', broadcast: true, persist: true });
    }

    if (eventType === 'motion.idle') {
      this.motionActive = false;
      this.lastMotionAt = Date.now(); // Reset the standby countdown explicitly when motion ends
      return this.refreshState({ source: 'esp32', reason: 'motion.idle', broadcast: true, persist: false });
    }

    if (eventType === 'display.page.toggle') {
      if (isStandby) {
        logger.info('Waking display from standby via page toggle button', {
          deviceId: event.deviceId || 'unknown',
        });
        return this.applyStandbyMode(false, 'button:turn_on');
      }

      if (typeof consoleService.isStatsOverlayActive === 'function' && consoleService.isStatsOverlayActive()) {
        logger.info('Ignoring page toggle while stats overlay is active', {
          deviceId: event.deviceId || 'unknown',
        });
        return this.refreshState({ source: 'esp32', reason: 'display.page.toggle:stats_ignored', broadcast: true, persist: false });
      }

      const websocketServer = require('../api/websocket');
      const consoleState = consoleService.getState();
      const displayedPage = String(consoleState.pageId || settingsService.get('current_page') || 'home');
      const currentPage = DISPLAY_PAGE_ORDER.includes(displayedPage) ? displayedPage : 'home';
      const currentIndex = DISPLAY_PAGE_ORDER.indexOf(currentPage);
      const nextPage = DISPLAY_PAGE_ORDER[(currentIndex + 1) % DISPLAY_PAGE_ORDER.length];

      await consoleService.openPage(nextPage, 'esp32_toggle');
      websocketServer.broadcastPageChange(nextPage, { source: 'esp32_toggle' });
      return this.refreshState({ source: 'esp32', reason: `display.page.toggle:${nextPage}`, broadcast: true, persist: true });
    }

    if (eventType === 'climate.reading') {
      return consoleService.handleEsp32Event({
        ...event,
        source: event.source || 'esp32',
      });
    }

    if (
      isStandby &&
      eventType === 'ui.action' &&
      (payload.buttonId === 'button5' || payload.button === 'button5' || payload.id === 'button5') &&
      ['back', 'close'].includes(String(payload.action || payload.command || '').toLowerCase())
    ) {
      return consoleService.handleEsp32Event({
        ...event,
        source: event.source || 'esp32',
      });
    }

    if (isStandby) {
      logger.info('Ignoring interactive ESP32 input while standby is active', {
        eventType,
        deviceId: event.deviceId || 'unknown',
      });
      return this.refreshState({ source: 'esp32', reason: `standby_ignored:${eventType}`, broadcast: true, persist: false });
    }

    if (eventType === 'button.press' || eventType === 'button.long_press') {
      const buttonId = payload.buttonId || payload.button || payload.id;
      if (buttonId) {
        return this.handleButtonAction(buttonId, eventType === 'button.long_press' ? 'long_press' : 'press');
      }
    }

    if (
      eventType === 'ui.page.open' ||
      eventType === 'ui.action' ||
      eventType === 'ui.adjust' ||
      eventType === 'alarm.dismiss' ||
      eventType === 'alarm.snooze'
    ) {
      return consoleService.handleEsp32Event({
        ...event,
        source: event.source || 'esp32',
      });
    }

    if (eventType === 'device.online' || eventType === 'device.offline') {
      return this.refreshState({ source: 'esp32', reason: eventType, broadcast: true, persist: false });
    }

    return this.getState();
  }

  async processInputEvent(event = {}, context = {}) {
    if (context?.source && !event.source) {
      event.source = context.source;
    }
    return this.handleEsp32Event(event);
  }

  async tick() {
    if (!this.initialized) {
      return;
    }

    const idleTimeoutMs = this.getIdleTimeoutMs();
    const standbyOnIdle = settingsService.get('presence.standbyOnIdle') !== false;
    const presenceEnabled = settingsService.get('presence.enabled') !== false;
    const isCurrentlyStandby = settingsService.get('display.standbyMode') === true;

    if (
      presenceEnabled &&
      standbyOnIdle &&
      this.lastMotionAt &&
      !this.motionActive &&
      !isCurrentlyStandby &&
      (Date.now() - this.lastMotionAt) >= idleTimeoutMs
    ) {
      await this.applyStandbyMode(true, 'presence_idle_timeout');
      return;
    }

    await this.refreshState({ source: 'tick', reason: 'timer', broadcast: false, persist: false });
  }

  async handleSettingsChanged(reason = 'settings_changed') {
    return this.refreshState({ source: 'settings', reason, broadcast: true, persist: true });
  }

  async handleSettingsUpdated(reason = 'settings_updated') {
    return this.handleSettingsChanged(reason);
  }
}

module.exports = new SceneEngine();
