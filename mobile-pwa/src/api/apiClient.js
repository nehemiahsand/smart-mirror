const configuredBase = import.meta.env.VITE_API_URL;
const isDevServer = window.location.port === '3002';
const API_BASE =
    configuredBase ||
    (isDevServer
        ? `http://${window.location.hostname}:3001`
        : window.location.origin);

export function apiFetch(path, options = {}) {
    const url =
        path.startsWith('http://') || path.startsWith('https://')
            ? path
            : `${API_BASE}${path}`;
    return fetch(url, {
        cache: 'no-store',
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

export async function apiRequest(path, body, options = {}) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await apiFetch(path, {
            ...options,
            signal: controller.signal,
            method: options.method || (body === undefined ? 'GET' : 'POST'),
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            headers: {
                ...(body === undefined
                    ? {}
                    : { 'Content-Type': 'application/json' }),
                ...options.headers
            }
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401)
            window.dispatchEvent(new Event('nexus:unauthorized'));
        if (!response.ok)
            throw new Error(
                data.error || `Request failed (${response.status})`
            );
        return data;
    } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', cancel);
    }
}
