import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNexusControllers } from '../state/useNexusControllers';
const deferred = () => {
    let resolve;
    const promise = new Promise((done) => {
        resolve = done;
    });
    return { promise, resolve };
};
const data = {
    console: {},
    lights: {
        lights: [
            { id: 'desk', name: 'Desk', online: true },
            { id: 'monitor', name: 'Monitor', online: true }
        ]
    }
};
function controllers(request) {
    const refresh = vi.fn(async () => {});
    const args = { data, errors: {}, connected: true, request, refresh };
    const hook = renderHook((props) => useNexusControllers(props), {
        initialProps: args
    });
    return { ...hook, refresh, args };
}
describe('shared route-independent command controllers', () => {
    it('retains a mirror lock across rerenders and prevents duplicate commands', async () => {
        const pending = deferred();
        const request = vi.fn(() => pending.promise);
        const { result, rerender, args } = controllers(request);
        let run;
        act(() => {
            run = result.current.mirror.run('/api/display/standby', {
                enabled: true
            });
        });
        rerender({ ...args, data: { ...data } });
        await act(async () => {
            await result.current.mirror.run('/api/console/button', {
                buttonId: 'button1'
            });
        });
        expect(request).toHaveBeenCalledTimes(1);
        expect(result.current.mirror.pending).toBe(true);
        await act(async () => {
            pending.resolve({});
            await run;
        });
        expect(result.current.mirror.pending).toBe(false);
    });
    it('serializes and coalesces final lighting commands across rerenders', async () => {
        const pending = deferred();
        const request = vi
            .fn()
            .mockImplementationOnce(() => pending.promise)
            .mockResolvedValue({});
        const { result, rerender, args } = controllers(request);
        let run;
        act(() => {
            run = result.current.lighting.send('desk', { brightness: 30 });
        });
        rerender({ ...args });
        await act(async () => {
            await result.current.lighting.send('desk', { brightness: 60 });
            await result.current.lighting.send('desk', { brightness: 90 });
        });
        expect(request).toHaveBeenCalledTimes(1);
        await act(async () => {
            pending.resolve({});
            await run;
        });
        expect(request).toHaveBeenNthCalledWith(2, '/api/lights/desk/command', {
            brightness: 90
        });
        expect(result.current.lighting.pending.desk).toBe(false);
    });
    it('reports group partial failure per board and refreshes authoritative state', async () => {
        const request = vi.fn(async () => ({
            results: [
                { id: 'desk', ok: true },
                { id: 'monitor', ok: false, error: 'unreachable' }
            ]
        }));
        const { result, refresh } = controllers(request);
        await act(async () => {
            await result.current.lighting.send('all', { on: true });
        });
        expect(result.current.lighting.error).toBe(
            'Desk: updated · Monitor: unreachable'
        );
        expect(result.current.lighting.message).toBe('');
        expect(refresh).toHaveBeenCalledWith('lights');
    });
    it('does not send commands when the affected integration is unavailable', async () => {
        const request = vi.fn();
        const { result, rerender, args } = controllers(request);
        rerender({
            ...args,
            errors: { lights: 'unavailable', console: 'unavailable' }
        });
        await act(async () => {
            await result.current.lighting.send('all', { on: true });
            await result.current.mirror.run('/api/display/standby', {
                enabled: true
            });
        });
        expect(request).not.toHaveBeenCalled();
    });
});
