import { describe, expect, it } from 'vitest';
import { localAlarmEpoch, isRetainedAlarm } from '../utils/clockTime';
describe('Chicago one-time alarm input', () => {
    it('never treats a reused firmware ID as the archived one-time alarm', () => {
        const archived = { id: 7, recurring: false, epoch: 100 };
        expect(isRetainedAlarm(archived, [{ id: 7, recurring: true }])).toBe(
            false
        );
        expect(
            isRetainedAlarm(archived, [{ id: 7, recurring: false, epoch: 200 }])
        ).toBe(false);
        expect(isRetainedAlarm(archived, [{ ...archived }])).toBe(true);
    });
    it('rejects nonexistent spring DST times instead of silently shifting the alarm', () =>
        expect(() => localAlarmEpoch('2026-03-08', '02:30')).toThrow(
            'does not exist'
        ));
    it('requires a choice for the repeated fall hour and maps both occurrences distinctly', () => {
        const { choices } = localAlarmEpoch('2026-11-01', '01:30');
        expect(choices).toHaveLength(2);
        const first = localAlarmEpoch(
            '2026-11-01',
            '01:30',
            choices[0].offset
        ).epoch;
        const second = localAlarmEpoch(
            '2026-11-01',
            '01:30',
            choices[1].offset
        ).epoch;
        expect(Math.abs(first - second)).toBe(3600);
    });
});
