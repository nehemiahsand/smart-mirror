export function lastSeen(timestamp) {
    if (!timestamp) return 'No readings received';
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    return seconds < 60
        ? 'Seen just now'
        : seconds < 3600
          ? `Seen ${Math.floor(seconds / 60)} min ago`
          : `Seen ${Math.floor(seconds / 3600)} h ago`;
}
export { deviceStatus as stateLabel } from './nexusSummary';
export function temperature(value, celsius) {
    return `${(celsius ? value : (value * 9) / 5 + 32).toFixed(1)}°${celsius ? 'C' : 'F'}`;
}
export function formatMeasurement(key, value, celsius = false) {
    if (value === null || value === undefined) return 'Unavailable';
    if (
        (key.endsWith('Percent') || key === 'humidity') &&
        Number.isFinite(value)
    )
        return `${Math.round(value * 10) / 10}%`;
    if (
        ['temperatureC', 'temperatureCelsius'].includes(key) &&
        Number.isFinite(value)
    )
        return temperature(value, celsius);
    if (
        (key === 'uptimeSeconds' || key === 'uptime') &&
        Number.isFinite(value)
    ) {
        if (value < 60) return `${Math.floor(value)}s`;
        if (value < 3600) return `${Math.floor(value / 60)}m`;
        if (value < 86400)
            return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`;
        return `${Math.floor(value / 86400)}d ${Math.floor((value % 86400) / 3600)}h`;
    }
    if (key.endsWith('Connected')) return value ? 'Connected' : 'Disconnected';
    if (key === 'sharpBusy') return value ? 'Busy' : 'Ready';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object')
        return (
            Object.entries(value)
                .map(
                    ([name, item]) =>
                        `${name}: ${formatMeasurement(name, item, celsius)}`
                )
                .join(' · ') || 'None reported'
        );
    return String(value);
}
