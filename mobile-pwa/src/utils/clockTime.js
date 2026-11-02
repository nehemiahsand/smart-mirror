import { DateTime } from 'luxon';
export const CLOCK_ZONE = 'America/Chicago';
export function isRetainedAlarm(alarm, current) {
    return current.some(
        (entry) =>
            entry.id === alarm.id &&
            entry.recurring === alarm.recurring &&
            (entry.recurring || entry.epoch === alarm.epoch)
    );
}
export function localAlarmEpoch(date, time, offset) {
    const input = `${date}T${time}`;
    const result = DateTime.fromISO(input, { zone: CLOCK_ZONE });
    if (!result.isValid || result.toFormat("yyyy-MM-dd'T'HH:mm") !== input)
        throw new Error(
            'This local time does not exist because of daylight saving time.'
        );
    const choices = result.getPossibleOffsets();
    if (choices.length > 1 && offset === undefined)
        return {
            choices: choices.map((item) => ({
                offset: item.offset,
                label: `${item.offsetNameShort} (${item.toFormat('ZZ')})`
            }))
        };
    const selected =
        choices.find((item) => item.offset === Number(offset)) || result;
    return { epoch: Math.floor(selected.toSeconds()) };
}
export function formatEpoch(epoch, format = '12h') {
    return epoch
        ? DateTime.fromSeconds(epoch, { zone: CLOCK_ZONE }).toFormat(
              format === '24h' ? 'HH:mm' : 'h:mm a'
          )
        : '—';
}
export function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return '—';
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export const isManualAlarm = (entry) =>
    /physical|manual/i.test(entry.origin || '');
export const isTerminalAlarm = (entry) =>
    !entry.recurring && ['fired', 'suppressed'].includes(entry.state);
export function clockSummary(snapshot) {
    const state = snapshot?.state;
    if (!state) return null;
    const timers = state.timers || [];
    const active = timers.filter(
        (timer) => timer.enabled && state.masterEnabled
    ).length;
    return {
        nextEpoch:
            Number.isFinite(state.next?.epoch) && state.next.epoch > 0
                ? state.next.epoch
                : null,
        scheduled: (state.alarms || []).filter(
            (alarm) => !isManualAlarm(alarm) && !isTerminalAlarm(alarm)
        ).length,
        timers: timers.length,
        activeTimers: active,
        suspendedTimers: timers.length - active,
        masterEnabled: !!state.masterEnabled,
        gateEnabled: !!state.sharpAlarmGateEnabled,
        busy: !!state.sharpBusy,
        stale: !snapshot.online || !snapshot.fresh
    };
}
