import { describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { installPreloadRecovery } from '../utils/preloadRecovery';

describe('App update recovery', () => {
    it('clears stale app assets before refreshing and prevents a reload loop', async () => {
        const target = new EventTarget();
        const entries = new Map();
        const storage = {
            getItem: (key) => entries.get(key),
            setItem: (key, value) => entries.set(key, value)
        };
        const reset = vi.fn(async () => {});
        const reload = vi.fn();
        const remove = installPreloadRecovery({
            target,
            storage,
            reset,
            reload,
            now: () => 100000
        });
        const first = new Event('vite:preloadError', { cancelable: true });
        target.dispatchEvent(first);
        expect(first.defaultPrevented).toBe(true);
        await waitFor(() => expect(reload).toHaveBeenCalledOnce());
        expect(reset).toHaveBeenCalledOnce();
        const second = new Event('vite:preloadError', { cancelable: true });
        target.dispatchEvent(second);
        expect(second.defaultPrevented).toBe(false);
        expect(reload).toHaveBeenCalledOnce();
        remove();
    });
    it('refreshes when cache cleanup fails but never refreshes without a reload guard', async () => {
        const target = new EventTarget();
        const storage = { getItem: () => null, setItem: vi.fn() };
        const reload = vi.fn();
        const remove = installPreloadRecovery({
            target,
            storage,
            reset: async () => {
                throw new Error('Cache unavailable');
            },
            reload
        });
        target.dispatchEvent(
            new Event('vite:preloadError', { cancelable: true })
        );
        await waitFor(() => expect(reload).toHaveBeenCalledOnce());
        remove();
        const removeBlocked = installPreloadRecovery({
            target,
            storage: {
                getItem: () => {
                    throw new Error('Storage blocked');
                }
            },
            reload
        });
        target.dispatchEvent(
            new Event('vite:preloadError', { cancelable: true })
        );
        expect(reload).toHaveBeenCalledOnce();
        removeBlocked();
    });
});
