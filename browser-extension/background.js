const MIRROR_TAB_KEY = 'mirrorTabId';
const MIRROR_URL_KEY = 'mirrorUrl';
const DEFAULT_MIRROR_URL = 'http://localhost:3000';

async function rememberMirrorTab(tab) {
  if (typeof tab?.id === 'number') {
    await chrome.storage.local.set({
      [MIRROR_TAB_KEY]: tab.id,
      [MIRROR_URL_KEY]: tab.url || DEFAULT_MIRROR_URL
    });
  }
}

async function findMirrorTab() {
  const stored = await chrome.storage.local.get(MIRROR_TAB_KEY);

  if (typeof stored[MIRROR_TAB_KEY] === 'number') {
    try {
      return await chrome.tabs.get(stored[MIRROR_TAB_KEY]);
    } catch {
      // The saved tab was closed; fall through to URL discovery.
    }
  }

  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => {
    try {
      const url = new URL(tab.url);
      return url.protocol === 'http:'
        && url.port === '3000'
        && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    } catch {
      return false;
    }
  });
}

async function openDesktopTab(tab) {
  if (!tab || typeof tab.id !== 'number' || typeof tab.windowId !== 'number') {
    return;
  }

  await rememberMirrorTab(tab);
  await chrome.windows.update(tab.windowId, { focused: true, state: 'maximized' });
  await chrome.tabs.create({ windowId: tab.windowId, active: true });
}

async function returnToMirror() {
  let tab = await findMirrorTab();

  if (!tab) {
    const stored = await chrome.storage.local.get(MIRROR_URL_KEY);
    tab = await chrome.tabs.create({
      url: stored[MIRROR_URL_KEY] || DEFAULT_MIRROR_URL,
      active: true
    });
  }

  if (typeof tab.id !== 'number' || typeof tab.windowId !== 'number') {
    return;
  }

  await rememberMirrorTab(tab);
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true, state: 'fullscreen' });
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'register-mirror-tab') {
    rememberMirrorTab(sender.tab).catch(console.error);
  } else if (message?.type === 'open-desktop-tab') {
    openDesktopTab(sender.tab).catch(console.error);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'return-to-mirror') {
    returnToMirror().catch(console.error);
  }
});
