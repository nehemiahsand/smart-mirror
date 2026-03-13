// If accessed via Vite dev server (port 3002), point to 3001. 
// If accessed via Caddy (port 80 or 443), use the current origin so Caddy can route it to /api/.
const isDevServer = window.location.port === '3002';
const API_BASE = isDevServer 
  ? `http://${window.location.hostname}:3001` 
  : window.location.origin;
const API_KEY = import.meta.env.VITE_API_KEY;

function buildHeaders(extra = {}) {
  const headers = { ...extra };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  const adminToken = window.localStorage.getItem('adminToken');
  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }
  return headers;
}

export function apiFetch(path, options = {}) {
  const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${API_BASE}${path}`;
  const mergedHeaders = buildHeaders(options.headers || {});
  return fetch(url, { ...options, headers: mergedHeaders });
}

export function getApiBase() {
  return API_BASE;
}
