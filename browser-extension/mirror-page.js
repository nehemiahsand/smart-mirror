const registerMirrorTab = () => {
  chrome.runtime.sendMessage({ type: 'register-mirror-tab' });
};

registerMirrorTab();

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  chrome.runtime.sendMessage({ type: 'open-desktop-tab' });
}, true);
