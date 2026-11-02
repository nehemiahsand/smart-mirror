import { describe, expect, it } from 'vitest';
import {
    deviceCounts,
    lightingSummary,
    sensorSummary
} from '../utils/nexusSummary';
import { clockSummary } from '../utils/clockTime';
describe('Home selectors', () => {
    it('classifies online before unconfigured and keeps absent data unknown', () => {
        expect(deviceCounts()).toBeNull();
        expect(
            deviceCounts([
                { online: true, status: 'not_configured' },
                { online: false, status: 'not_configured' },
                { online: false }
            ])
        ).toEqual({ total: 3, online: 1, setup: 1, offline: 1 });
    });
    it('does not count offline retained lighting power as current', () => {
        expect(
            lightingSummary([
                { online: true, state: { on: true } },
                { online: false, state: { on: true } }
            ])
        ).toMatchObject({ on: 1, unknown: 1, allOn: false });
    });
    it('preserves zero readings and marks old or missing timestamps stale', () => {
        expect(
            sensorSummary(
                {
                    sensor: {
                        temperatureFahrenheit: 0,
                        humidity: 0,
                        timestamp: 1
                    }
                },
                200000
            )
        ).toMatchObject({ temperature: 0, humidity: 0, stale: true });
        expect(sensorSummary({})).toMatchObject({
            temperature: null,
            humidity: null,
            stale: true
        });
    });
    it('uses only the clock reported next occurrence, omits terminal/manual scheduled entries, and counts suspended timers', () => {
        expect(clockSummary()).toBeNull();
        expect(
            clockSummary({
                online: true,
                fresh: true,
                state: {
                    next: { epoch: 123 },
                    masterEnabled: false,
                    timers: [{ enabled: true }],
                    alarms: [
                        { recurring: true },
                        { recurring: false, state: 'fired' },
                        { origin: 'physical' }
                    ]
                }
            })
        ).toMatchObject({
            nextEpoch: 123,
            scheduled: 1,
            activeTimers: 0,
            suspendedTimers: 1
        });
    });
});
