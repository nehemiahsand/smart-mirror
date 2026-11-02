const recoveryKey = 'nexus-preload-recovery-at';

async function resetCachedApp() {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
            registrations.map((registration) => registration.unregister())
        );
    }
    if ('caches' in window) {
        const names = await window.caches.keys();
        await Promise.all(
            names
                .filter((name) => name.startsWith('workbox-precache-'))
                .map((name) => window.caches.delete(name))
        );
    }
}

// An open tab can reference a removed lazy chunk after an app update. Recover
// once, then let persistent failures surface instead of creating a reload loop.
export function installPreloadRecovery({
    target = window,
    storage = {
        getItem: (key) => window.sessionStorage.getItem(key),
        setItem: (key, value) => window.sessionStorage.setItem(key, value)
    },
    reset = resetCachedApp,
    reload = () => window.location.reload(),
    now = Date.now
} = {}) {
    const recover = (event) => {
        try {
            const previous = storage.getItem(recoveryKey);
            if (previous && now() - Number(previous) < 60000) return;
            storage.setItem(recoveryKey, String(now()));
        } catch {
            // Without a persistent guard, refreshing could loop indefinitely.
            return;
        }
        event.preventDefault();
        Promise.resolve()
            .then(reset)
            .catch(() => {})
            .finally(reload);
    };
    target.addEventListener('vite:preloadError', recover);
    return () => target.removeEventListener('vite:preloadError', recover);
}
