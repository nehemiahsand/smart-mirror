import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useWebSocket } from '../../../display/src/hooks/useWebSocket';
afterEach(() => vi.unstubAllGlobals());
it('reloads a stale display during standby while ordinary updates stay suspended', () => {
    let socket;
    class FakeSocket { constructor() { socket = this; } close() {} }
    vi.stubGlobal('WebSocket', FakeSocket);
    const reload = vi.fn();
    const onPage = vi.fn();
    const onListening = vi.fn();
    const { result, unmount } = renderHook(() => useWebSocket(onPage, onListening, reload));
    act(() => socket.onmessage({ data: JSON.stringify({ type: 'settings_update', data: { display: { standbyMode: true } } }) }));
    act(() => socket.onmessage({ data: JSON.stringify({ type: 'time', data: { time: 'should be ignored' } }) }));
    expect(result.current.time).toBeNull();
    act(() => socket.onmessage({ data: JSON.stringify({ type: 'display_refresh' }) }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.settings.display.standbyMode).toBe(true);
    expect(onPage).not.toHaveBeenCalled();
    unmount();
    expect(socket.onclose).toBeNull();
});
