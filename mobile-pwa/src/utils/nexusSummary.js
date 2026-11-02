export function deviceStatus(device) {
    return device.online
        ? 'Online'
        : device.status === 'not_configured'
          ? 'Not configured'
          : 'Offline';
}
export function deviceCounts(devices) {
    if (!devices) return null;
    return {
        total: devices.length,
        online: devices.filter((device) => device.online).length,
        setup: devices.filter(
            (device) => !device.online && device.status === 'not_configured'
        ).length,
        offline: devices.filter(
            (device) => !device.online && device.status !== 'not_configured'
        ).length
    };
}
export function sensorSummary(data, now = Date.now()) {
    const sensor = data.sensor;
    const celsius = data.config?.preferences?.temperature === 'celsius';
    const temperature =
        sensor?.[celsius ? 'temperatureCelsius' : 'temperatureFahrenheit'];
    const timestamp = sensor?.timestamp
        ? new Date(sensor.timestamp).getTime()
        : NaN;
    return {
        temperature: Number.isFinite(temperature) ? temperature : null,
        humidity: Number.isFinite(sensor?.humidity) ? sensor.humidity : null,
        unit: celsius ? 'C' : 'F',
        stale:
            !!sensor?.stale ||
            !Number.isFinite(timestamp) ||
            now - timestamp > 180000
    };
}
export function lightingSummary(lights) {
    if (!lights) return null;
    const known = lights.filter(
        (light) => light.online && typeof light.state?.on === 'boolean'
    );
    const on = known.filter((light) => light.state.on).length;
    return {
        total: lights.length,
        on,
        unknown: lights.length - known.length,
        allOn:
            lights.length > 0 &&
            known.length === lights.length &&
            on === lights.length,
        mixed: on > 0 && on < known.length,
        available: lights.some((light) => light.online)
    };
}
export function brightnessPercent(light) {
    return Number.isFinite(light.state?.bri)
        ? Math.round((light.state.bri * 100) / 255)
        : null;
}
