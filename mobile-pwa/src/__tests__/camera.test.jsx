import { render } from './render';
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../api/apiClient', () => ({
    apiRequest: mocks.request,
    getApiBase: () => 'http://localhost:3001'
}));
import Camera from '../pages/Camera';
afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: false
    });
});
describe('Camera lifecycle', () => {
    it('automatically requests a scoped stream and removes it on backgrounding/unmount', async () => {
        mocks.request.mockImplementation(async (path) =>
            path === '/api/camera/status' ? { enabled: true } : path === '/api/privacy/status' ? { cameraEnabled: true } : { token: 'test-token' }
        );
        const { unmount } = render(<Camera />);
        const image = await screen.findByAltText('Live mirror camera');
        expect(image.src).toContain('streamToken=test-token');
        expect(screen.queryByText('Live preview')).toBeNull();
        fireEvent.load(image);
        expect(screen.getByText('Live preview')).toBeInTheDocument();
        act(() => {
            Object.defineProperty(document, 'hidden', {
                configurable: true,
                value: true
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(screen.queryByAltText('Live mirror camera')).toBeNull();
        unmount();
    });
    it('never starts a stream when global capture is disabled', async () => {
        mocks.request.mockImplementation(async (path) => path === '/api/privacy/status' ? { cameraEnabled: false } : path === '/api/camera/status' ? { enabled: false } : { token: 'unused-token' });
        render(<Camera />);
        await screen.findByText('Camera input is disabled');
        expect(screen.queryByAltText('Live mirror camera')).toBeNull();
        expect(mocks.request).toHaveBeenCalledWith('/api/privacy/status', undefined, expect.any(Object));
    });
});
it('keeps a token from opening a stream before authoritative privacy resolves', async () => {
    let resolvePrivacy;
    mocks.request.mockImplementation((path) => path === '/api/privacy/status' ? new Promise((resolve) => { resolvePrivacy = resolve; }) : Promise.resolve(path === '/api/auth/stream-token' ? { token: 'scoped-token' } : {}));
    render(<Camera />);
    expect(screen.queryByAltText('Live mirror camera')).toBeNull();
    await act(async () => resolvePrivacy({ cameraEnabled: false }));
    expect(screen.queryByAltText('Live mirror camera')).toBeNull();
    expect(screen.getByText('Camera input is disabled')).toBeInTheDocument();
});
it('offers retry after a stream error and renews its scoped authorization', async () => {
    mocks.request.mockImplementation(async (path) => path === '/api/privacy/status' ? { cameraEnabled: true } : path === '/api/auth/stream-token' ? { token: 'scoped-token' } : {});
    const { unmount } = render(<Camera />);
    fireEvent.error(await screen.findByAltText('Live mirror camera'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
    await screen.findByAltText('Live mirror camera');
    expect(mocks.request.mock.calls.filter(([p]) => p === '/api/auth/stream-token')).toHaveLength(2);
    unmount();
});
