const climateService = require('./climate');
const fs = require('fs');
const logger = require('../utils/logger');
const os = require('os');
const settingsService = require('./settings');
const spotifyService = require('./spotify');
const weatherService = require('./weather');

const DEFAULT_PAGES = {
  dynamic: { id: 'dynamic', name: 'Main Page', title: 'Main Page', enabled: true },
  weather: { id: 'weather', name: 'Weather', title: 'Weather', enabled: true },
  media: { id: 'media', name: 'Spotify', title: 'Spotify', enabled: true },
  'timer-focus': { id: 'timer-focus', name: 'Timer / Focus', title: 'Timer / Focus', enabled: true },
};

const PAGE_ORDER = ['dynamic', 'weather', 'media', 'timer-focus'];
const OLED_PAGE_ORDER = ['dynamic', 'media'];
const WEATHER_TABS = ['current', 'hourly', 'daily', 'alerts'];
const TIMER_FOCUS_MODES = ['timer', 'focus'];
const THERMAL_SENSOR_PATHS = [
  '/sys/class/thermal/thermal_zone0/temp',
  '/sys/class/thermal/thermal_zone1/temp',
];
const STATS_CACHE_TTL_MS = 5000;

const PAGE_ID_ALIASES = {
  home: 'dynamic',
  main: 'dynamic',
  apps: 'dynamic',
  spotify: 'media',
  music: 'media',
  alarm: 'timer-focus',
  focus: 'timer-focus',
  timer: 'timer-focus',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function padTime(value) {
  return String(value).padStart(2, '0');
}

function parseClockValue(value) {
  if (typeof value !== 'string' || !value.includes(':')) {
    return null;
  }

  const [hoursText, minutesText] = value.split(':');
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }

  return { hours, minutes };
}

function formatClockValue(hours, minutes) {
  return `${padTime(hours)}:${padTime(minutes)}`;
}

function dateKeyForLocalDate(date) {
  return `${date.getFullYear()}-${padTime(date.getMonth() + 1)}-${padTime(date.getDate())}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cycleIndex(currentIndex, length, delta) {
  return (currentIndex + delta + length) % length;
}

function normalizeDelta(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value !== 0) {
    return value > 0 ? 1 : -1;
  }
  return 1;
}

function formatUptimeShort(totalSeconds) {
  const safeSeconds = Math.max(Number(totalSeconds) || 0, 0);
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function readCpuTemperatureC() {
  for (const sensorPath of THERMAL_SENSOR_PATHS) {
    try {
      const raw = fs.readFileSync(sensorPath, 'utf8').trim();
      const value = Number.parseFloat(raw);
      if (!Number.isFinite(value)) {
        continue;
      }

      return value > 1000 ? Math.round(value / 1000) : Math.round(value);
    } catch (_) {
      continue;
    }
  }

  return null;
}

function snapshotCpuTimes() {
  const cpus = os.cpus() || [];
  return cpus.reduce((accumulator, cpu) => {
    const times = cpu?.times || {};
    const total = Object.values(times).reduce((sum, value) => sum + value, 0);
    return {
      idle: accumulator.idle + (times.idle || 0),
      total: accumulator.total + total,
    };
  }, { idle: 0, total: 0 });
}

function normalizePageTarget(pageId) {
  const normalized = String(pageId || '').trim().toLowerCase();
  const rawPageId = normalized || 'dynamic';
  const canonicalPageId = PAGE_ID_ALIASES[rawPageId] || rawPageId;
  const target = { pageId: canonicalPageId };

  if (rawPageId === 'focus') {
    target.timerFocusMode = 'focus';
  } else if (['alarm', 'timer'].includes(rawPageId)) {
    target.timerFocusMode = 'timer';
  }

  return target;
}

function normalizePageId(pageId) {
  return normalizePageTarget(pageId).pageId;
}

function getPresentedPageId(pageId) {
  const normalizedPageId = normalizePageId(pageId);
  if (normalizedPageId === 'dynamic') {
    return 'home';
  }
  if (normalizedPageId === 'media') {
    return 'spotify';
  }
  return normalizedPageId;
}

function getPresentedPageMeta(pageId) {
  const normalizedPageId = normalizePageId(pageId);
  if (normalizedPageId === 'dynamic') {
    return { id: 'home', name: 'Main Page', title: 'Main Page' };
  }
  if (normalizedPageId === 'media') {
    return { id: 'spotify', name: 'Spotify', title: 'Spotify' };
  }
  return {
    id: normalizedPageId,
    name: normalizedPageId,
    title: normalizedPageId,
  };
}

class ConsoleService {
  constructor() {
    this.initialized = false;
    this.tickInterval = null;
    this.state = {
      activePageId: 'dynamic',
      expiresAt: null,
      lastInteractionAt: null,
      weatherTabId: 'current',
      timerFocusMode: 'timer',
      overlayId: null,
      lastAction: null,
      updatedAt: Date.now(),
    };
    this.runtime = {
      alarmRinging: false,
      alarmTriggeredDate: null,
      snoozeUntil: null,
      focusStatus: 'idle',
      focusPhase: 'work',
      focusEndsAt: null,
      focusRemainingMs: null,
      timerStatus: 'idle',
      timerEndsAt: null,
      timerRemainingMs: null,
      systemStats: null,
      cpuSnapshot: snapshotCpuTimes(),
    };
  }

  initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.tickInterval = setInterval(() => {
      this.tick().catch((error) => {
        logger.error('Console service tick failed', { error: error.message });
      });
    }, 1000);
    logger.info('Console service initialized');
  }

  close() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  isManualPage(pageId = this.state.activePageId) {
    return normalizePageId(pageId) !== 'dynamic';
  }

  isStandbyActive() {
    return settingsService.get('display.standbyMode') === true;
  }

  isStatsOverlayVisible() {
    return this.state.overlayId === 'stats';
  }

  getPages() {
    const configuredPages = settingsService.get('interactivePages') || {};
    const pageOverrides = {
      dynamic: configuredPages.dynamic || configuredPages.home || configuredPages.main || {},
      weather: configuredPages.weather || {},
      media: configuredPages.media || configuredPages.music || configuredPages.spotify || {},
      'timer-focus': configuredPages['timer-focus'] || configuredPages.timer || configuredPages.focus || configuredPages.alarm || {},
    };

    return Object.fromEntries(
      PAGE_ORDER.map((pageId) => {
        const defaults = DEFAULT_PAGES[pageId];
        const override = pageOverrides[pageId] || {};
        return [
          pageId,
          {
            ...defaults,
            ...override,
            name: override.name || override.title || defaults.name,
            title: override.title || override.name || defaults.title,
          },
        ];
      })
    );
  }

  getEnabledPageOrder() {
    const pages = this.getPages();
    return OLED_PAGE_ORDER.filter((pageId) => pages[pageId]?.enabled !== false);
  }

  getPresentedPages() {
    const pages = this.getPages();
    return Object.fromEntries(
      this.getEnabledPageOrder().map((pageId) => {
        const page = pages[pageId];
        const presentedPage = getPresentedPageMeta(pageId);
        return [
          presentedPage.id,
          {
            ...page,
            id: presentedPage.id,
            name: presentedPage.name,
            title: presentedPage.title,
          },
        ];
      })
    );
  }

  getInactivityTimeoutMs() {
    const seconds = Number(settingsService.get('console.inactivityTimeoutSeconds'));
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 180000;
  }

  getDefaultPageId() {
    const configuredDefault = normalizePageId(settingsService.get('console.defaultPageId') || 'dynamic');
    if (this.getPages()[configuredDefault]?.enabled !== false) {
      return configuredDefault;
    }
    return 'dynamic';
  }

  isPageEnabled(pageId) {
    const normalizedPageId = normalizePageId(pageId);
    return this.getPages()[normalizedPageId]?.enabled !== false;
  }

  buildAlarmSummary() {
    const alarmSettings = settingsService.get('alarm') || {};
    const nextTriggerAt = this.getNextAlarmTriggerAt(new Date());

    return {
      enabled: alarmSettings.enabled !== false,
      armed: alarmSettings.armed === true,
      label: alarmSettings.label || 'Mirror Alarm',
      time: alarmSettings.time || alarmSettings.defaultTime || '07:00',
      snoozeMinutes: Number(alarmSettings.snoozeMinutes) || 10,
      ringing: this.runtime.alarmRinging,
      snoozeUntil: this.runtime.snoozeUntil,
      nextTriggerAt,
    };
  }

  buildFocusSummary() {
    const focusSettings = settingsService.get('focus') || {};
    const now = Date.now();
    const remainingMs = this.runtime.focusEndsAt
      ? Math.max(this.runtime.focusEndsAt - now, 0)
      : this.runtime.focusRemainingMs;

    return {
      workMinutes: Number(focusSettings.workMinutes ?? focusSettings.defaultWorkMinutes) || 25,
      breakMinutes: Number(focusSettings.breakMinutes ?? focusSettings.defaultBreakMinutes) || 5,
      autoStartBreak: focusSettings.autoStartBreak === true,
      status: this.runtime.focusStatus,
      running: this.runtime.focusStatus === 'running',
      paused: this.runtime.focusStatus === 'paused',
      completed: this.runtime.focusStatus === 'completed',
      phase: this.runtime.focusPhase,
      endsAt: this.runtime.focusEndsAt,
      remainingMs: Number.isFinite(remainingMs) ? remainingMs : null,
    };
  }

  buildTimerSummary() {
    const timerSettings = settingsService.get('timer') || {};
    const now = Date.now();
    const remainingMs = this.runtime.timerEndsAt
      ? Math.max(this.runtime.timerEndsAt - now, 0)
      : this.runtime.timerRemainingMs;
    const defaultMinutes = Number(timerSettings.defaultMinutes) || 10;

    return {
      defaultMinutes,
      maxMinutes: Number(timerSettings.maxMinutes) || 180,
      buzzerOnComplete: timerSettings.buzzerOnComplete !== false,
      status: this.runtime.timerStatus,
      running: this.runtime.timerStatus === 'running',
      paused: this.runtime.timerStatus === 'paused',
      completed: this.runtime.timerStatus === 'completed',
      endsAt: this.runtime.timerEndsAt,
      remainingMs: Number.isFinite(remainingMs) ? remainingMs : defaultMinutes * 60000,
    };
  }

  getSoftButtons(pageId = null, options = {}) {
    if (options.screenMode === 'standby') {
      return {
        button1: 'Turn On',
        button2: '',
        button3: '',
        button4: '',
        button5: '',
      };
    }

    if (options.overlayId === 'stats') {
      return {
        button1: '',
        button2: '',
        button3: '',
        button4: '',
        button5: 'Close',
      };
    }

    const targetPageId = normalizePageId(pageId || this.state.activePageId);
    const timerSummary = this.buildTimerSummary();
    const focusSummary = this.buildFocusSummary();
    const pageToggleTarget = getPresentedPageMeta(targetPageId === 'media' ? 'dynamic' : 'media');

    switch (targetPageId) {
      case 'weather':
        return {
          button1: pageToggleTarget.name,
          button2: 'Prev',
          button3: 'Next',
          button4: 'Refresh',
          button5: 'Stats',
        };
      case 'media':
        return {
          button1: pageToggleTarget.name,
          button2: 'Play/Pause',
          button3: 'Prev',
          button4: 'Next',
          button5: 'Stats',
        };
      case 'timer-focus':
        return {
          button1: pageToggleTarget.name,
          button2: 'Timer',
          button3: 'Focus',
          button4: this.state.timerFocusMode === 'timer'
            ? (timerSummary.running ? 'Pause' : (timerSummary.paused ? 'Resume' : 'Start'))
            : (focusSummary.running ? 'Pause' : (focusSummary.paused ? 'Resume' : 'Start')),
          button5: 'Stats',
        };
      case 'dynamic':
      default:
        return {
          button1: pageToggleTarget.name,
          button2: '',
          button3: '',
          button4: '',
          button5: 'Stats',
        };
    }
  }

  getSystemStats() {
    const now = Date.now();
    if (this.runtime.systemStats && (now - this.runtime.systemStats.updatedAt) < STATS_CACHE_TTL_MS) {
      return this.runtime.systemStats;
    }

    const currentSnapshot = snapshotCpuTimes();
    const previousSnapshot = this.runtime.cpuSnapshot;
    let cpuPercent = this.runtime.systemStats?.cpuPercent ?? null;
    if (
      previousSnapshot &&
      currentSnapshot.total > previousSnapshot.total &&
      currentSnapshot.idle >= previousSnapshot.idle
    ) {
      const totalDelta = currentSnapshot.total - previousSnapshot.total;
      const idleDelta = currentSnapshot.idle - previousSnapshot.idle;
      cpuPercent = Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
    }

    this.runtime.cpuSnapshot = currentSnapshot;

    const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
    const usedMemMb = Math.max(totalMemMb - freeMemMb, 0);
    const ramPercent = totalMemMb > 0 ? Math.round((usedMemMb / totalMemMb) * 100) : 0;
    const cpuTempC = readCpuTemperatureC();
    const loadAvg1m = Number(os.loadavg()[0] || 0).toFixed(2);

    this.runtime.systemStats = {
      updatedAt: now,
      cpuPercent,
      cpuTempC,
      ramPercent,
      usedMemMb,
      totalMemMb,
      uptimeSeconds: Math.floor(os.uptime()),
      loadAvg1m,
      cpuCount: (os.cpus() || []).length,
    };

    return this.runtime.systemStats;
  }

  buildStatsOverlay(currentPageTitle) {
    const stats = this.getSystemStats();
    const cpuSummary = stats.cpuTempC != null
      ? `CPU ${stats.cpuPercent ?? '--'}% ${stats.cpuTempC}C`
      : `CPU ${stats.cpuPercent ?? '--'}%`;
    const lines = [
      cpuSummary,
      `RAM ${stats.ramPercent}% ${stats.usedMemMb}/${stats.totalMemMb}M`,
      `Up ${formatUptimeShort(stats.uptimeSeconds)}`,
      `Load ${stats.loadAvg1m} C${stats.cpuCount}`,
    ];

    return {
      id: 'stats',
      title: 'Mirror Stats',
      sourcePageTitle: currentPageTitle,
      line1: lines[0],
      line2: lines[1],
      line3: lines[2],
      line4: lines[3],
      lines,
      stats,
    };
  }

  getState() {
    const canonicalPageId = normalizePageId(this.state.activePageId);
    const syncedMirrorPageId = normalizePageId(settingsService.get('current_page') || canonicalPageId);
    const displayedCanonicalPageId = syncedMirrorPageId === 'media' ? 'media' : 'dynamic';
    const presentedPage = getPresentedPageMeta(displayedCanonicalPageId);
    const presentedPages = this.getPresentedPages();
    const pageOrder = Object.keys(presentedPages);
    const standby = this.isStandbyActive();
    const overlay = standby || !this.isStatsOverlayVisible() ? null : this.buildStatsOverlay(presentedPage.title);
    const screenMode = standby ? 'standby' : (overlay ? 'stats' : 'page');
    const softButtons = this.getSoftButtons(displayedCanonicalPageId, {
      screenMode,
      overlayId: overlay?.id || null,
    });

    return clone({
      ...this.state,
      standby,
      screenMode,
      activePageId: presentedPage.id,
      pageId: presentedPage.id,
      canonicalPageId: displayedCanonicalPageId,
      mirrorPageId: presentedPage.id,
      active: !standby,
      interactiveActive: !standby,
      pages: presentedPages,
      pageOrder,
      pageTitle: standby ? 'Standby' : (overlay?.title || presentedPage.title),
      statusLabel: standby
        ? 'Motion or 1 wakes'
        : (overlay ? `Back to ${presentedPage.title}` : (presentedPage.id === 'spotify' ? 'Spotify controls' : 'Mirror ready')),
      softButtons,
      overlay,
      alarm: this.buildAlarmSummary(),
      timer: this.buildTimerSummary(),
      focus: this.buildFocusSummary(),
      climate: {
        primarySource: climateService.getPrimarySource(),
        compareMode: climateService.isCompareModeEnabled(),
        esp32Available: !!climateService.getEsp32Reading(),
      },
    });
  }

  touchInteraction(action = 'interaction') {
    const now = Date.now();
    this.state.lastInteractionAt = now;
    this.state.updatedAt = now;
    this.state.lastAction = action;
    this.state.expiresAt = this.isManualPage() ? now + this.getInactivityTimeoutMs() : null;
  }

  broadcastState() {
    const websocketServer = require('../api/websocket');
    websocketServer.broadcastConsoleState(this.getState());
  }

  async broadcastPageData(pageId = this.state.activePageId) {
    const websocketServer = require('../api/websocket');
    const normalizedPageId = normalizePageId(pageId);
    const data = await this.getPageData(normalizedPageId);
    websocketServer.broadcastConsolePageData(normalizedPageId, data);
    return data;
  }

  async openPage(pageId, source = 'api') {
    const target = normalizePageTarget(pageId);
    const normalizedPageId = target.pageId;
    if (settingsService.get('console.enabled') === false) {
      throw new Error('Console mode is disabled');
    }

    if (!this.isPageEnabled(normalizedPageId)) {
      throw new Error(`Unknown or disabled console page: ${pageId}`);
    }

    this.state.activePageId = normalizedPageId;
    if (target.timerFocusMode) {
      this.state.timerFocusMode = target.timerFocusMode;
    }
    if (!WEATHER_TABS.includes(this.state.weatherTabId)) {
      this.state.weatherTabId = 'current';
    }

    this.touchInteraction(`open:${normalizedPageId}:${source}`);
    this.broadcastState();
    if (this.isManualPage(normalizedPageId)) {
      await this.broadcastPageData(normalizedPageId);
    }
    return this.getState();
  }

  async closeInteractive(source = 'api') {
    this.state.activePageId = this.getDefaultPageId();
    this.state.expiresAt = null;
    this.state.overlayId = null;
    this.state.lastAction = `close:${source}`;
    this.state.updatedAt = Date.now();
    this.broadcastState();
    return this.getState();
  }

  async goHome(source = 'api') {
    return this.openPage('dynamic', source);
  }

  async toggleStatsOverlay(source = 'api') {
    if (this.isStandbyActive()) {
      return this.getState();
    }

    this.state.overlayId = this.isStatsOverlayVisible() ? null : 'stats';
    this.touchInteraction(this.state.overlayId ? `overlay:stats:open:${source}` : `overlay:stats:close:${source}`);
    this.broadcastState();
    return this.getState();
  }

  handleStandbyActivated(source = 'system') {
    if (this.state.overlayId) {
      this.state.overlayId = null;
      this.state.lastAction = `overlay:stats:hidden:${source}`;
      this.state.updatedAt = Date.now();
      this.broadcastState();
    }
  }

  getNextPageId(delta = 1, currentPageId = this.state.activePageId) {
    const enabledPages = this.getEnabledPageOrder();
    if (enabledPages.length === 0) {
      return 'dynamic';
    }

    const normalizedPageId = normalizePageId(currentPageId);
    const currentIndex = enabledPages.indexOf(normalizedPageId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    return enabledPages[cycleIndex(safeIndex, enabledPages.length, normalizeDelta(delta))];
  }

  async toggleMusicPlayback() {
    const playback = await this.getPlaybackState();
    if (playback?.is_playing) {
      await spotifyService.pause();
    } else {
      await spotifyService.play();
    }
  }

  async getPlaybackState() {
    try {
      return await spotifyService.getCurrentPlayback();
    } catch (error) {
      logger.debug('Spotify playback unavailable', { error: error.message });
      return null;
    }
  }

  getNextAlarmTriggerAt(now = new Date()) {
    const alarmSettings = settingsService.get('alarm') || {};
    if (alarmSettings.enabled === false || alarmSettings.armed !== true) {
      return null;
    }

    if (Number.isFinite(this.runtime.snoozeUntil) && this.runtime.snoozeUntil > now.getTime()) {
      return this.runtime.snoozeUntil;
    }

    const parsed = parseClockValue(alarmSettings.time || alarmSettings.defaultTime || '07:00');
    if (!parsed) {
      return null;
    }

    const trigger = new Date(now);
    trigger.setHours(parsed.hours, parsed.minutes, 0, 0);
    if (trigger.getTime() <= now.getTime()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    return trigger.getTime();
  }

  async setAlarmTime(updates = {}) {
    const alarmSettings = settingsService.get('alarm') || {};
    const parsed = parseClockValue(alarmSettings.time || alarmSettings.defaultTime || '07:00') || { hours: 7, minutes: 0 };
    const hours = clamp(updates.hours != null ? updates.hours : parsed.hours, 0, 23);
    const minutes = clamp(updates.minutes != null ? updates.minutes : parsed.minutes, 0, 59);

    await settingsService.updateMultiple({
      'alarm.time': formatClockValue(hours, minutes),
      'alarm.defaultTime': formatClockValue(hours, minutes),
    });
  }

  async toggleAlarmArmed(forceValue = null) {
    const currentArmed = settingsService.get('alarm.armed') === true;
    await settingsService.updateMultiple({
      'alarm.armed': typeof forceValue === 'boolean' ? forceValue : !currentArmed,
    });
    if (!currentArmed) {
      this.runtime.alarmTriggeredDate = null;
    }
  }

  dismissAlarm() {
    this.runtime.alarmRinging = false;
    this.runtime.snoozeUntil = null;
    this.state.lastAction = 'alarm.dismiss';
    this.state.updatedAt = Date.now();
  }

  async snoozeAlarm() {
    const snoozeMinutes = Number(settingsService.get('alarm.snoozeMinutes')) || 10;
    this.runtime.alarmRinging = false;
    this.runtime.snoozeUntil = Date.now() + (snoozeMinutes * 60000);
    this.state.lastAction = 'alarm.snooze';
    this.state.updatedAt = Date.now();
    this.broadcastState();
    return this.getState();
  }

  async adjustTimer(delta) {
    const timerSettings = settingsService.get('timer') || {};
    const currentMinutes = Number(timerSettings.defaultMinutes) || 10;
    const maxMinutes = Number(timerSettings.maxMinutes) || 180;
    const nextMinutes = clamp(currentMinutes + delta, 1, maxMinutes);

    await settingsService.updateMultiple({
      'timer.defaultMinutes': nextMinutes,
    });

    if (this.runtime.timerStatus !== 'running') {
      this.runtime.timerRemainingMs = nextMinutes * 60000;
      if (this.runtime.timerStatus === 'completed') {
        this.runtime.timerStatus = 'idle';
      }
    }
  }

  startTimer() {
    const timerSettings = settingsService.get('timer') || {};
    const timerMinutes = Number(timerSettings.defaultMinutes) || 10;
    this.runtime.timerStatus = 'running';
    this.runtime.timerRemainingMs = timerMinutes * 60000;
    this.runtime.timerEndsAt = Date.now() + this.runtime.timerRemainingMs;
  }

  pauseTimer() {
    if (this.runtime.timerStatus !== 'running' || !this.runtime.timerEndsAt) {
      return;
    }

    this.runtime.timerRemainingMs = Math.max(this.runtime.timerEndsAt - Date.now(), 0);
    this.runtime.timerEndsAt = null;
    this.runtime.timerStatus = 'paused';
  }

  resumeTimer() {
    if (this.runtime.timerStatus !== 'paused' || !Number.isFinite(this.runtime.timerRemainingMs)) {
      return;
    }

    this.runtime.timerStatus = 'running';
    this.runtime.timerEndsAt = Date.now() + this.runtime.timerRemainingMs;
  }

  resetTimer() {
    const timerSettings = settingsService.get('timer') || {};
    const timerMinutes = Number(timerSettings.defaultMinutes) || 10;
    this.runtime.timerStatus = 'idle';
    this.runtime.timerEndsAt = null;
    this.runtime.timerRemainingMs = timerMinutes * 60000;
  }

  async startFocusSession() {
    const workMinutes = Number(settingsService.get('focus.workMinutes') ?? settingsService.get('focus.defaultWorkMinutes')) || 25;
    this.runtime.focusStatus = 'running';
    this.runtime.focusPhase = 'work';
    this.runtime.focusEndsAt = Date.now() + (workMinutes * 60000);
    this.runtime.focusRemainingMs = workMinutes * 60000;
  }

  pauseFocusSession() {
    if (this.runtime.focusStatus !== 'running' || !this.runtime.focusEndsAt) {
      return;
    }

    this.runtime.focusRemainingMs = Math.max(this.runtime.focusEndsAt - Date.now(), 0);
    this.runtime.focusStatus = 'paused';
    this.runtime.focusEndsAt = null;
  }

  resumeFocusSession() {
    if (this.runtime.focusStatus !== 'paused' || !Number.isFinite(this.runtime.focusRemainingMs)) {
      return;
    }

    this.runtime.focusStatus = 'running';
    this.runtime.focusEndsAt = Date.now() + this.runtime.focusRemainingMs;
  }

  resetFocusSession() {
    this.runtime.focusStatus = 'idle';
    this.runtime.focusPhase = 'work';
    this.runtime.focusEndsAt = null;
    this.runtime.focusRemainingMs = null;
  }

  async handleDynamicAction() {
    return this.getState();
  }

  async handleWeatherAction(action) {
    const currentIndex = WEATHER_TABS.indexOf(this.state.weatherTabId);
    if (action === 'previous') {
      this.state.weatherTabId = WEATHER_TABS[cycleIndex(currentIndex, WEATHER_TABS.length, -1)];
    } else if (action === 'next') {
      this.state.weatherTabId = WEATHER_TABS[cycleIndex(currentIndex, WEATHER_TABS.length, 1)];
    } else if (['primary', 'refresh', 'confirm'].includes(action)) {
      weatherService.clearCache();
    } else if (['back', 'alerts'].includes(action)) {
      this.state.weatherTabId = this.state.weatherTabId === 'alerts' ? 'current' : 'alerts';
    } else if (['home', 'close'].includes(action)) {
      return this.goHome('weather_home');
    }

    this.touchInteraction(`weather:${action}`);
    this.broadcastState();
    await this.broadcastPageData('weather');
    return this.getState();
  }

  async handleMediaAction(action) {
    if (action === 'previous') {
      await spotifyService.previous();
    } else if (action === 'next') {
      await spotifyService.next();
    } else if (['primary', 'toggle', 'confirm'].includes(action)) {
      await this.toggleMusicPlayback();
    } else if (['back', 'home', 'close'].includes(action)) {
      return this.goHome('media_home');
    }

    this.touchInteraction(`media:${action}`);
    this.broadcastState();
    await this.broadcastPageData('media');
    return this.getState();
  }

  async handleTimerFocusAction(action, payload = {}) {
    const pageTarget = normalizePageTarget(payload.pageId);
    if (pageTarget.timerFocusMode) {
      this.state.timerFocusMode = pageTarget.timerFocusMode;
    }

    if (action === 'previous' || action === 'timer') {
      this.state.timerFocusMode = 'timer';
    } else if (action === 'next' || action === 'focus') {
      this.state.timerFocusMode = 'focus';
    } else if (['primary', 'confirm', 'toggle'].includes(action)) {
      if (this.state.timerFocusMode === 'timer') {
        if (this.runtime.timerStatus === 'running') {
          this.pauseTimer();
        } else if (this.runtime.timerStatus === 'paused') {
          this.resumeTimer();
        } else {
          this.startTimer();
        }
      } else if (this.runtime.focusStatus === 'running') {
        this.pauseFocusSession();
      } else if (this.runtime.focusStatus === 'paused') {
        this.resumeFocusSession();
      } else {
        await this.startFocusSession();
      }
    } else if (['back', 'reset'].includes(action)) {
      if (this.state.timerFocusMode === 'timer') {
        this.resetTimer();
      } else {
        this.resetFocusSession();
      }
    } else if (['home', 'close'].includes(action)) {
      return this.goHome('timer_focus_home');
    }

    this.touchInteraction(`timer-focus:${action}`);
    this.broadcastState();
    await this.broadcastPageData('timer-focus');
    return this.getState();
  }

  async handleAction(action, payload = {}) {
    const normalizedAction = String(action || '').toLowerCase();
    const pageTarget = normalizePageTarget(payload.pageId || this.state.activePageId || this.getDefaultPageId());
    const pageId = pageTarget.pageId;

    if (payload.buttonId === 'button5') {
      return this.toggleStatsOverlay(payload.source || 'button5');
    }

    if (this.isStatsOverlayVisible()) {
      return this.getState();
    }

    if (normalizedAction === 'open' && payload.targetPageId) {
      return this.openPage(payload.targetPageId, payload.source || 'action_open');
    }

    if (normalizedAction === 'toggle-arm') {
      await this.toggleAlarmArmed();
      this.touchInteraction('alarm:toggle-arm');
      this.broadcastState();
      if (this.isManualPage()) {
        await this.broadcastPageData(this.state.activePageId);
      }
      return this.getState();
    }

    switch (pageId) {
      case 'weather':
        return this.handleWeatherAction(normalizedAction);
      case 'media':
        return this.handleMediaAction(normalizedAction);
      case 'timer-focus':
        return this.handleTimerFocusAction(normalizedAction, payload);
      case 'dynamic':
      default:
        return this.handleDynamicAction(normalizedAction);
    }
  }

  async handleAdjust(delta, payload = {}) {
    const pageTarget = normalizePageTarget(payload.pageId || this.state.activePageId || this.getDefaultPageId());
    const nextPageId = this.getNextPageId(delta, pageTarget.pageId);
    return this.openPage(nextPageId, payload.source || 'adjust');
  }

  async handleEsp32Event(event = {}) {
    const payload = event.payload || {};

    switch (event.type) {
      case 'climate.reading': {
        const reading = climateService.recordEsp32Reading(payload, {
          deviceId: event.deviceId,
          timestamp: event.timestamp,
        });
        if (reading) {
          const websocketServer = require('../api/websocket');
          const currentReading = await climateService.getCurrentReading();
          websocketServer.broadcastSensorData(currentReading);
        }
        break;
      }
      case 'ui.page.open':
        return this.openPage(payload.pageId || payload.page || this.getDefaultPageId(), event.source || 'esp32');
      case 'ui.action':
        return this.handleAction(payload.action || payload.command || 'primary', {
          buttonId: payload.buttonId || payload.button || payload.id,
          pageId: payload.pageId,
          targetPageId: payload.targetPageId,
          source: event.source || 'esp32',
        });
      case 'ui.adjust':
        return this.handleAdjust(payload.delta ?? payload.step ?? payload.value ?? 1, {
          pageId: payload.pageId,
          source: event.source || 'esp32',
        });
      case 'alarm.dismiss':
        this.dismissAlarm();
        this.broadcastState();
        break;
      case 'alarm.snooze':
        return this.snoozeAlarm();
      default:
        break;
    }

    return this.getState();
  }

  async getDynamicPageData() {
    const settings = settingsService.getAll();
    const [climate, weather] = await Promise.all([
      climateService.getCurrentReading().catch(() => null),
      weatherService.getCurrentWeather(settings.weather.city, settings.weather.units).catch(() => null),
    ]);

    return {
      pageId: 'home',
      canonicalPageId: 'dynamic',
      title: this.getPages().dynamic?.title || 'Main Page',
      status: 'automatic',
      summary: 'Scene-driven mirror view',
      climate: climate && !climate.error ? climate : null,
      weather: weather && !weather.error ? weather : null,
      softButtons: this.getSoftButtons('dynamic'),
    };
  }

  async getWeatherPageData() {
    const settings = settingsService.getAll();
    const weather = await weatherService.getDetailedWeather(settings.weather.city, settings.weather.units);
    return {
      pageId: 'weather',
      title: this.getPages().weather?.title || 'Weather',
      activeTabId: this.state.weatherTabId,
      tabs: WEATHER_TABS.map((tabId) => ({
        id: tabId,
        label: tabId.charAt(0).toUpperCase() + tabId.slice(1),
        active: tabId === this.state.weatherTabId,
      })),
      ...weather,
      softButtons: this.getSoftButtons('weather'),
    };
  }

  async getMediaPageData() {
    const playback = await this.getPlaybackState();
    const item = playback?.item || {};
    const album = item?.album || {};

    return {
      pageId: 'spotify',
      canonicalPageId: 'media',
      title: this.getPages().media?.title || 'Spotify',
      trackName: item?.name || null,
      artistName: Array.isArray(item?.artists) ? item.artists.map((artist) => artist.name).join(', ') : null,
      albumName: album?.name || null,
      albumArtUrl: Array.isArray(album?.images) ? album.images[0]?.url || null : null,
      durationMs: item?.duration_ms ?? null,
      progressMs: playback?.progress_ms ?? 0,
      isPlaying: playback?.is_playing === true,
      deviceName: playback?.device?.name || null,
      volumePercent: playback?.device?.volume_percent ?? null,
      contextType: playback?.context?.type || null,
      playback: playback || { is_playing: false },
      softButtons: this.getSoftButtons('media'),
    };
  }

  async getTimerFocusPageData(pageId = this.state.activePageId) {
    const target = normalizePageTarget(pageId);
    const activeMode = target.timerFocusMode || this.state.timerFocusMode || 'timer';
    const timer = this.buildTimerSummary();
    const focus = this.buildFocusSummary();

    return {
      pageId: 'timer-focus',
      title: this.getPages()['timer-focus']?.title || 'Timer / Focus',
      activeMode,
      modes: TIMER_FOCUS_MODES.map((modeId) => ({
        id: modeId,
        label: modeId === 'timer' ? 'Timer' : 'Focus',
        active: modeId === activeMode,
      })),
      timer: {
        ...timer,
        remainingSeconds: timer.remainingMs != null ? Math.ceil(timer.remainingMs / 1000) : null,
        statusLabel: timer.running
          ? 'Running'
          : (timer.paused ? 'Paused' : (timer.completed ? 'Done' : 'Ready')),
      },
      focus: {
        ...focus,
        remainingSeconds: focus.remainingMs != null ? Math.ceil(focus.remainingMs / 1000) : null,
        stateLabel: focus.status === 'running'
          ? `${focus.phase === 'break' ? 'Break' : 'Work'} in progress`
          : focus.status.charAt(0).toUpperCase() + focus.status.slice(1),
      },
      softButtons: this.getSoftButtons('timer-focus'),
    };
  }

  async getPageData(pageId = this.state.activePageId) {
    const target = normalizePageTarget(pageId);
    const normalizedPageId = target.pageId;

    if (!this.isPageEnabled(normalizedPageId)) {
      throw new Error(`Unknown or disabled console page: ${pageId}`);
    }

    switch (normalizedPageId) {
      case 'weather':
        return this.getWeatherPageData();
      case 'media':
        return this.getMediaPageData();
      case 'timer-focus':
        return this.getTimerFocusPageData(pageId);
      case 'dynamic':
      default:
        return this.getDynamicPageData();
    }
  }

  async handleSettingsChanged(reason = 'settings_changed') {
    this.state.activePageId = normalizePageId(this.state.activePageId);
    if (this.isStandbyActive()) {
      this.state.overlayId = null;
    }
    if (!this.isPageEnabled(this.state.activePageId)) {
      this.state.activePageId = this.getDefaultPageId();
      this.state.expiresAt = null;
    }
    if (!TIMER_FOCUS_MODES.includes(this.state.timerFocusMode)) {
      this.state.timerFocusMode = 'timer';
    }
    if (!WEATHER_TABS.includes(this.state.weatherTabId)) {
      this.state.weatherTabId = 'current';
    }
    this.state.lastAction = reason;
    this.state.updatedAt = Date.now();
    this.broadcastState();
    if (this.isManualPage()) {
      await this.broadcastPageData(this.state.activePageId);
    }
    return this.getState();
  }

  async tick() {
    const now = Date.now();
    let changed = false;

    if (this.isManualPage() && Number.isFinite(this.state.expiresAt) && this.state.expiresAt <= now) {
      this.state.activePageId = this.getDefaultPageId();
      this.state.expiresAt = null;
      this.state.lastAction = 'timeout';
      this.state.updatedAt = now;
      changed = true;
    }

    const alarmSettings = settingsService.get('alarm') || {};
    const alarmEnabled = alarmSettings.enabled !== false && alarmSettings.armed === true;
    const parsedTime = parseClockValue(alarmSettings.time || '07:00');
    if (alarmEnabled && parsedTime) {
      const nowDate = new Date(now);
      const todayKey = dateKeyForLocalDate(nowDate);

      if (Number.isFinite(this.runtime.snoozeUntil) && now >= this.runtime.snoozeUntil) {
        this.runtime.alarmRinging = true;
        this.runtime.snoozeUntil = null;
        changed = true;
      }

      if (!this.runtime.alarmRinging) {
        const trigger = new Date(nowDate);
        trigger.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
        if (now >= trigger.getTime() && this.runtime.alarmTriggeredDate !== todayKey) {
          this.runtime.alarmRinging = true;
          this.runtime.alarmTriggeredDate = todayKey;
          changed = true;
        }
      }
    }

    if (this.runtime.focusStatus === 'running' && this.runtime.focusEndsAt && now >= this.runtime.focusEndsAt) {
      const autoStartBreak = settingsService.get('focus.autoStartBreak') === true;
      if (this.runtime.focusPhase === 'work' && autoStartBreak) {
        const breakMinutes = Number(settingsService.get('focus.breakMinutes') ?? settingsService.get('focus.defaultBreakMinutes')) || 5;
        this.runtime.focusPhase = 'break';
        this.runtime.focusStatus = 'running';
        this.runtime.focusRemainingMs = breakMinutes * 60000;
        this.runtime.focusEndsAt = now + this.runtime.focusRemainingMs;
      } else {
        this.runtime.focusStatus = 'completed';
        this.runtime.focusRemainingMs = 0;
        this.runtime.focusEndsAt = null;
      }
      changed = true;
    }

    if (this.runtime.timerStatus === 'running' && this.runtime.timerEndsAt && now >= this.runtime.timerEndsAt) {
      this.runtime.timerStatus = 'completed';
      this.runtime.timerRemainingMs = 0;
      this.runtime.timerEndsAt = null;
      changed = true;
    }

    if (changed) {
      this.state.updatedAt = now;
      this.broadcastState();
      if (this.isManualPage()) {
        await this.broadcastPageData(this.state.activePageId);
      }
    }
  }
}

module.exports = new ConsoleService();
