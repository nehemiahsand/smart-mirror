const settingsService = require('./settings');

const PAGE_ID_ALIASES = {
  home: 'dynamic',
  main: 'dynamic',
  apps: 'dynamic',
  spotify: 'media',
  music: 'media',
  weather: 'weather',
  timer: 'timer-focus',
  focus: 'timer-focus',
  alarm: 'timer-focus',
  'timer-focus': 'timer-focus',
  dynamic: 'dynamic',
  media: 'media',
};

const PAGE_TITLES = {
  dynamic: 'Dynamic',
  weather: 'Weather',
  media: 'Media',
  'timer-focus': 'Timer / Focus',
};

function normalizePageId(pageId) {
  const normalized = String(pageId || '').trim().toLowerCase();
  return PAGE_ID_ALIASES[normalized] || 'dynamic';
}

class ConsoleService {
  getActivePageId() {
    return normalizePageId(settingsService.get('current_page'));
  }

  getSoftButtons(pageId = this.getActivePageId()) {
    switch (normalizePageId(pageId)) {
      case 'weather':
        return {
          button1: 'Prev Tab',
          button2: 'Next Tab',
          button3: 'Refresh',
          button4: 'Dynamic',
          dial: 'Pages',
        };
      case 'media':
        return {
          button1: 'Prev',
          button2: 'Next',
          button3: 'Play/Pause',
          button4: 'Dynamic',
          dial: 'Pages',
        };
      case 'timer-focus':
        return {
          button1: 'Timer',
          button2: 'Focus',
          button3: 'Start',
          button4: 'Reset',
          dial: 'Pages',
        };
      case 'dynamic':
      default:
        return {
          button1: '--',
          button2: '--',
          button3: '--',
          button4: '--',
          dial: 'Pages',
        };
    }
  }

  getState() {
    const activePageId = this.getActivePageId();
    const standbyMode = settingsService.get('display.standbyMode') === true;

    return {
      activePageId,
      pageId: activePageId,
      active: activePageId !== 'dynamic',
      interactiveActive: activePageId !== 'dynamic',
      pageTitle: PAGE_TITLES[activePageId] || 'Dynamic',
      statusLabel: standbyMode ? 'Standby active' : (activePageId === 'dynamic' ? 'Automatic dynamic page' : 'Manual page'),
      lastAction: standbyMode ? 'Wake mirror to interact' : 'Ready',
      softButtons: this.getSoftButtons(activePageId),
      standbyMode,
      updatedAt: Date.now(),
    };
  }

  getPageState(pageId) {
    const normalizedPageId = normalizePageId(pageId);
    return {
      pageId: normalizedPageId,
      title: PAGE_TITLES[normalizedPageId] || 'Dynamic',
      summary: this.getState(),
      softButtons: this.getSoftButtons(normalizedPageId),
      updatedAt: Date.now(),
    };
  }
}

module.exports = new ConsoleService();
