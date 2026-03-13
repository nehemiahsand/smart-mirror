const configuredBase = import.meta.env.VITE_API_URL;
const isDevServer = window.location.port === '3002';
const API_BASE = configuredBase || (
  isDevServer
    ? `http://${window.location.hostname}:3001`
    : window.location.origin
);

export function apiFetch(path, options = {}) {
  const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${API_BASE}${path}`;
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...(options.headers || {}) }
  });
}

export async function fetchAuthSession() {
  const response = await apiFetch('/api/auth/session');
  if (!response.ok) {
    return { authenticated: false };
  }
  return response.json();
}

export function getApiBase() {
  return API_BASE;
}
