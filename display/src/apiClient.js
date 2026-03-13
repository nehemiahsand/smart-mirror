function getDefaultApiUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost';
  }

  return `${window.location.protocol}//${window.location.hostname}`;
}

const API_URL = import.meta.env.VITE_API_URL || getDefaultApiUrl();

function buildHeaders(extra = {}) {
  return { ...extra };
}

export function apiFetch(path, options = {}) {
  const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${API_URL}${path}`;
  const mergedHeaders = buildHeaders(options.headers || {});
  return fetch(url, { ...options, headers: mergedHeaders });
}

export function getApiUrl() {
  return API_URL;
}
