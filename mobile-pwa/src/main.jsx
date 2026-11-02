import React from 'react';
import ReactDOM from 'react-dom/client';
import { NexusTheme } from './components/NexusTheme';
import App from './App';
import { installPreloadRecovery } from './utils/preloadRecovery';

const CACHE_BUSTER_VERSION = 'nexus-two-teams-20261030';
installPreloadRecovery();
document.documentElement.dataset.theme = ['light', 'dark', 'system'].includes(
    localStorage.getItem('nexus-theme')
)
    ? localStorage.getItem('nexus-theme')
    : 'dark';

async function clearStalePwaCaches() {
    try {
        const key = 'pwa_cache_buster_version';
        const previousVersion = window.localStorage.getItem(key);
        if (previousVersion === CACHE_BUSTER_VERSION) {
            return;
        }

        if ('serviceWorker' in navigator) {
            const registrations =
                await navigator.serviceWorker.getRegistrations();
            await Promise.all(
                registrations.map((registration) => registration.unregister())
            );
        }

        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }

        window.localStorage.setItem(key, CACHE_BUSTER_VERSION);
    } catch (error) {
        console.warn('Failed to clear stale PWA caches', error);
    }
}

clearStalePwaCaches().finally(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
        <React.StrictMode>
            <NexusTheme>
                <App />
            </NexusTheme>
        </React.StrictMode>
    );
});
