import { render } from './render';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
const mocks = vi.hoisted(() => ({
    request: vi.fn(async () => ({})),
    refresh: vi.fn(async () => {}),
    data: {
        console: {
            standby: false,
            pageTitle: 'Weather',
            softButtons: {
                button1: 'Sports',
                button2: '',
                button3: '',
                button4: 'Refresh'
            }
        },
        config: { devices: [], preferences: {} }
    }
}));
vi.mock('../state/NexusProvider', () => ({
    useNexus: () => ({
        data: mocks.data,
        errors: {},
        connected: true,
        request: mocks.request,
        refresh: mocks.refresh,
        commands: {
            mirror: {
                pending: false,
                available: true,
                error: '',
                message: '',
                run: async (path, body) => {
                    await mocks.request(path, body);
                    return true;
                }
            }
        }
    })
}));
import Mirror from '../pages/Mirror';
describe('Mirror remote', () => {
    it('preserves unavailable ESP buttons and uses a separate explicit standby action', async () => {
        render(
            <MemoryRouter initialEntries={['/mirror/controls']}>
                <Routes>
                    <Route path="/mirror/:view" element={<Mirror />} />
                </Routes>
            </MemoryRouter>
        );
        const unavailable = screen.getAllByRole('button', {
            name: /Unavailable/
        });
        expect(unavailable).toHaveLength(2);
        unavailable.forEach((button) => expect(button).toBeDisabled());
        fireEvent.click(screen.getByRole('button', { name: 'Standby' }));
        await waitFor(() =>
            expect(mocks.request).toHaveBeenCalledWith('/api/display/standby', {
                enabled: true
            })
        );
        expect(screen.queryByText(/hold for/i)).toBeNull();
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: /4 Refresh/ })
            ).not.toBeDisabled()
        );
        fireEvent.click(screen.getByRole('button', { name: /4 Refresh/ }));
        await waitFor(() =>
            expect(mocks.request).toHaveBeenCalledWith('/api/console/button', {
                buttonId: 'button4'
            })
        );
    });
});
