import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from './render';
vi.mock('../state/NexusProvider', () => ({
    useNexus: () => ({
        data: {
            config: { preferences: { temperature: 'celsius' } },
            devices: {
                devices: [
                    {
                        id: 'mirror',
                        name: 'Mirror',
                        kind: 'pi',
                        online: true,
                        lastSeen: Date.now(),
                        measurements: {
                            cpuPercent: 0,
                            memoryPercent: 38,
                            temperatureC: 40
                        }
                    },
                    {
                        id: 'mac',
                        name: 'Mac',
                        kind: 'computer',
                        online: false,
                        status: 'offline',
                        measurements: { cpuPercent: 19 }
                    },
                    {
                        id: 'thinkpad',
                        name: 'ThinkPad',
                        kind: 'computer',
                        online: false,
                        status: 'not_configured',
                        measurements: {}
                    }
                ]
            }
        },
        errors: {},
        request: vi.fn(),
        refresh: vi.fn()
    })
}));
import Monitor, { formatMeasurement } from '../pages/Monitor';
describe('Monitor overview', () => {
    it('shows actual readings with units, labels stale data, and filters devices', () => {
        render(
            <MemoryRouter initialEntries={['/monitor/devices']}>
                <Routes>
                    <Route path="/monitor/:view" element={<Monitor />} />
                </Routes>
            </MemoryRouter>
        );
        const mirror = screen.getByRole('link', { name: /Mirror host Mirror/ });
        expect(within(mirror).getByText('0%')).toBeInTheDocument();
        expect(within(mirror).getByText('40.0°C')).toBeInTheDocument();
        expect(within(mirror).queryByText('Storage')).toBeNull();
        const mac = screen.getByRole('link', { name: /Computer Mac/ });
        expect(
            within(mac).getByText('Last known readings')
        ).toBeInTheDocument();
        const thinkpad = screen.getByRole('link', {
            name: /Computer ThinkPad/
        });
        expect(within(thinkpad).queryByText('0%')).toBeNull();
        fireEvent.change(
            screen.getByRole('textbox', { name: 'Search devices' }),
            { target: { value: 'think' } }
        );
        expect(screen.queryByRole('link', { name: /Computer Mac/ })).toBeNull();
        expect(
            screen.getByRole('link', { name: /Computer ThinkPad/ })
        ).toBeInTheDocument();
    });
    it('formats reported temperature and uptime without changing device data', () => {
        expect(formatMeasurement('temperatureC', 40)).toBe('104.0°F');
        expect(formatMeasurement('uptimeSeconds', 90000)).toBe('1d 1h');
        expect(formatMeasurement('cpuPercent', null)).toBe('Unavailable');
    });
});
