import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render } from './render';
const mocks = vi.hoisted(() => ({
    context: null,
    request: vi.fn(),
    run: vi.fn(),
    send: vi.fn()
}));
vi.mock('../state/NexusProvider', () => ({ useNexus: () => mocks.context }));
import Home from '../pages/Home';
function setup() {
    return render(
        <MemoryRouter>
            <Home />
        </MemoryRouter>
    );
}
beforeEach(() => {
    mocks.request.mockReset().mockResolvedValue({ photos: [] });
    mocks.run.mockReset();
    mocks.send.mockReset();
    mocks.context = {
        connected: true,
        errors: {},
        request: mocks.request,
        commands: {
            mirror: {
                available: true,
                pending: false,
                error: '',
                message: '',
                run: mocks.run
            },
            lighting: { pending: {}, error: '', message: '', send: mocks.send }
        },
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
            sensor: {
                temperatureFahrenheit: 0,
                humidity: 0,
                timestamp: Date.now()
            },
            config: { preferences: { clockFormat: '12h' } },
            clock: {
                online: true,
                fresh: true,
                state: {
                    next: { epoch: Date.UTC(2026, 9, 21, 12) / 1000 },
                    masterEnabled: true,
                    sharpAlarmGateEnabled: true,
                    timers: [],
                    alarms: [{ id: 1, recurring: true, enabled: true }]
                }
            },
            lights: {
                lights: [
                    {
                        id: 'desk',
                        name: 'Desk',
                        online: true,
                        state: { on: true, bri: 0 }
                    },
                    {
                        id: 'monitor',
                        name: 'Monitor',
                        online: true,
                        state: { on: false }
                    }
                ]
            },
            devices: {
                devices: [
                    {
                        id: 'mirror',
                        name: 'Mirror / Pi',
                        online: true,
                        measurements: { cpuPercent: 0 }
                    },
                    { id: 'clock', name: 'Clock', online: true },
                    { id: 'desk', name: 'Desk', online: true },
                    { id: 'monitor', name: 'Monitor', online: true },
                    {
                        id: 'esp',
                        name: 'ESP console',
                        online: false,
                        status: 'not_configured'
                    },
                    {
                        id: 'mac',
                        name: 'Mac',
                        online: false,
                        status: 'not_configured'
                    },
                    {
                        id: 'thinkpad',
                        name: 'ThinkPad',
                        online: false,
                        measurements: { cpuPercent: 11 }
                    }
                ]
            }
        }
    };
});
afterEach(() => localStorage.clear());
describe('Control Room Home', () => {
    it('uses real summaries, keeps zero values, and never requests a camera stream', async () => {
        setup();
        expect(screen.getByText('4 / 7 devices online')).toBeInTheDocument();
        expect(screen.getByText('2 devices need setup')).toBeInTheDocument();
        const table = screen.getByRole('table');
        expect(within(table).getByText('0%')).toBeInTheDocument();
        expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
        expect(within(table).getByText('Last known')).toBeInTheDocument();
        expect(
            screen.getByRole('meter', { name: 'Desk brightness' })
        ).toHaveAttribute('aria-valuenow', '0');
        expect(
            screen.queryByRole('meter', { name: 'Monitor brightness' })
        ).toBeNull();
        expect(screen.queryByRole('slider')).toBeNull();
        await screen.findByRole('link', { name: 'Photos · 0' });
        expect(mocks.request.mock.calls.map((call) => call[0])).toEqual([
            '/api/photos'
        ]);
        expect(screen.queryByAltText('Live mirror camera')).toBeNull();
    });
    it('shares ESP commands and explicitly gates Standby and Wake', () => {
        setup();
        expect(screen.getByRole('button', { name: 'Wake up' })).toBeDisabled();
        expect(
            screen.getAllByRole('button', { name: /Unavailable/ })
        ).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: 'Standby' }));
        expect(mocks.run).toHaveBeenCalledWith('/api/display/standby', {
            enabled: true
        });
        fireEvent.click(screen.getByRole('button', { name: '4 Refresh' }));
        expect(mocks.run).toHaveBeenCalledWith('/api/console/button', {
            buttonId: 'button4'
        });
    });
    it('handles standby, unavailable mirror, and failed resources independently', () => {
        mocks.context.commands.mirror.available = false;
        mocks.context.data.console.standby = true;
        mocks.context.errors.clock = 'Clock unreachable';
        mocks.context.data.clock = undefined;
        mocks.context.errors.lights = 'Lights unreachable';
        setup();
        expect(screen.getByRole('button', { name: 'Standby' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Wake up' })).toBeDisabled();
        expect(
            screen.getByRole('switch', { name: 'Desk power' })
        ).toBeDisabled();
        expect(screen.getByText('Clock unreachable')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Mirror / Pi' })
        ).toBeInTheDocument();
    });
    it('uses reported next occurrence and distinguishes suspended clock state', () => {
        Object.assign(mocks.context.data.clock, {
            online: false,
            fresh: false
        });
        Object.assign(mocks.context.data.clock.state, {
            masterEnabled: false,
            sharpBusy: true,
            sharpAlarmGateEnabled: false,
            timers: [{ enabled: true }, { enabled: false }]
        });
        mocks.context.data.sensor.timestamp = Date.now() - 190000;
        setup();
        expect(screen.getAllByText('7:00 AM').length).toBeGreaterThan(0);
        expect(screen.getByText('2 suspended')).toBeInTheDocument();
        expect(screen.getByText('Sharp controller busy')).toBeInTheDocument();
        expect(screen.getByText(/Native output disabled/)).toBeInTheDocument();
        expect(
            screen.getByText(/Last known sensor reading/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Manual alarm' })
        ).toHaveAttribute('href', '/alarms/alarms#manual');
    });
    it('turns a mixed lighting group on and keeps offline boards disabled', () => {
        setup();
        expect(screen.getByText('Mixed power state')).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole('switch', { name: 'All lights power' })
        );
        expect(mocks.send).toHaveBeenCalledWith('all', { on: true });
        fireEvent.click(screen.getByRole('switch', { name: 'Desk power' }));
        expect(mocks.send).toHaveBeenCalledWith('desk', { on: false });
    });
    it('caps the list, refreshes photo metadata on foreground, and cleans up listeners', async () => {
        mocks.context.data.devices.devices.push({
            id: 'extra',
            name: 'Extra device',
            online: false
        });
        const { unmount } = setup();
        expect(screen.getAllByRole('row')).toHaveLength(8);
        expect(
            screen.getByRole('link', { name: 'View all 8 devices' })
        ).toBeInTheDocument();
        await screen.findByRole('link', { name: 'Photos · 0' });
        fireEvent(window, new Event('focus'));
        await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
        unmount();
        fireEvent(window, new Event('focus'));
        expect(mocks.request).toHaveBeenCalledTimes(2);
    });
});
