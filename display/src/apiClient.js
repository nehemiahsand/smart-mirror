const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_API_KEY;

function buildHeaders(extra = {}) {
  const headers = { ...extra };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
}

export function apiFetch(path, options = {}) {
  const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${API_URL}${path}`;
  const mergedHeaders = buildHeaders(options.headers || {});
  return fetch(url, { ...options, headers: mergedHeaders });
}

export function getApiUrl() {
  return API_URL;
}
