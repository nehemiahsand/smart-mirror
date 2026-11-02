import { render } from './render';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { Brightness } from '../pages/Lights';
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
describe('WLED slider interaction', () => {
    it('coalesces a drag, sends the final release, and cancels work on unmount', () => {
        vi.useFakeTimers();
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            top: 0,
            width: 100,
            height: 10,
            right: 100,
            bottom: 10
        });
        const commit = vi.fn();
        const { unmount } = render(
            <Brightness label="Desk brightness" value={30} onCommit={commit} />
        );
        const track = screen
            .getByRole('slider')
            .closest('.mantine-Slider-trackContainer');
        fireEvent.mouseDown(track, { clientX: 31, clientY: 5 });
        act(() => vi.advanceTimersByTime(20));
        fireEvent.mouseMove(document, { clientX: 60, clientY: 5 });
        act(() => vi.advanceTimersByTime(20));
        expect(commit).not.toHaveBeenCalled();
        fireEvent.mouseUp(document);
        act(() => vi.advanceTimersByTime(1));
        expect(commit).toHaveBeenCalledWith(60);
        fireEvent.mouseDown(track, { clientX: 90, clientY: 5 });
        act(() => vi.advanceTimersByTime(20));
        unmount();
        act(() => vi.advanceTimersByTime(1000));
        expect(commit).toHaveBeenCalledTimes(1);
    });
    it('commits keyboard changes immediately', () => {
        const commit = vi.fn();
        render(
            <Brightness label="Desk brightness" value={30} onCommit={commit} />
        );
        fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
        expect(commit).toHaveBeenCalledWith(100);
    });
});
