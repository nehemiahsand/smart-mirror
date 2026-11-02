import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from './render';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../api/apiClient', () => ({ apiFetch: mocks.fetch }));
import WiFiSettings from '../pages/WiFiSettings';
const response = (data, ok = true) => ({ ok, json: async () => data });
afterEach(() => vi.clearAllMocks());

describe('Mirror networking', () => {
    it('allows open networks without a password and reports rejected changes', async () => {
        mocks.fetch.mockImplementation(async (path) => {
            if (path.endsWith('/current'))
                return response({ ssid: 'Guest', signal: 0 });
            if (path.endsWith('/scan'))
                return response({
                    networks: [{ ssid: 'Guest', secured: false, signal: 0 }]
                });
            return response(
                { error: 'Network changes are unavailable' },
                false
            );
        });
        render(<WiFiSettings />);
        const network = await screen.findByRole('button', { name: /Guest/ });
        fireEvent.click(network);
        expect(
            screen.getByRole('heading', { name: 'Connect to Guest' })
        ).toHaveFocus();
        expect(screen.queryByLabelText('Wi-Fi password')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Connect', exact: true })
        ).toBeEnabled();
        fireEvent.click(
            screen.getByRole('button', { name: 'Connect', exact: true })
        );
        await screen.findByText('Network changes are unavailable');
        expect(mocks.fetch).toHaveBeenCalledWith(
            '/api/wifi/connect',
            expect.objectContaining({
                body: JSON.stringify({ ssid: 'Guest', password: '' })
            })
        );
        expect(screen.getAllByText('Signal: 0%').length).toBeGreaterThan(0);
    });
    it('requires secured passwords, labels visibility controls, and restores selection focus', async () => {
        mocks.fetch.mockImplementation(async (path) =>
            response(
                path.endsWith('/scan')
                    ? {
                          networks: [
                              { ssid: 'Private', secured: true, signal: 70 }
                          ]
                      }
                    : {}
            )
        );
        render(<WiFiSettings />);
        const network = await screen.findByRole('button', { name: /Private/ });
        fireEvent.click(network);
        expect(
            screen.getByRole('button', { name: 'Connect', exact: true })
        ).toBeDisabled();
        const password = screen.getByLabelText('Wi-Fi password', {
            exact: true
        });
        fireEvent.change(password, { target: { value: 'fixture-password' } });
        expect(
            screen.getByRole('button', { name: 'Connect', exact: true })
        ).toBeEnabled();
        fireEvent.click(
            screen.getByRole('button', { name: 'Show Wi-Fi password' })
        );
        expect(password).toHaveAttribute('type', 'text');
        fireEvent.click(
            screen.getByRole('button', { name: 'Cancel', exact: true })
        );
        await waitFor(() => expect(network).toHaveFocus());
    });
});
