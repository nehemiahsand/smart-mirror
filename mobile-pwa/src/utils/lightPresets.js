const rainbow = 'linear-gradient(110deg, #b33b4b, #c88426, #46765c, #286b9c, #75509b)';
export function savedPresets(light) {
    return Object.entries(light?.presets || {}).filter(([id, preset]) =>
        Number(id) > 0 && Number(id) <= 250 && preset && typeof preset === 'object'
    );
}
export function presetBackground(preset) {
    if (/star\s*wars/i.test(preset?.n || ''))
        return 'linear-gradient(90deg, #0000ff 0%, #0000ff 49%, #ff0000 51%, #ff0000 100%)';
    const segments = Array.isArray(preset?.seg) ? preset.seg : [];
    if (segments.some((segment) => segment.fx === 9)) return rainbow;
    const colors = segments.map((segment) => segment.col?.[0]).filter((rgb) =>
        Array.isArray(rgb) && rgb.length >= 3 && rgb.slice(0, 3).every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ).map((rgb) => `rgb(${rgb.slice(0, 3).join(',')})`);
    if (!colors.length) return 'var(--raised, var(--surface))';
    return `linear-gradient(90deg, ${colors.length === 1 ? [colors[0], colors[0]].join(',') : colors.join(',')})`;
}
export function pairBackground(pair, lights) {
    const members = Object.entries(pair.devices).map(([id, number]) => lights.find((light) => light.id === id)?.presets?.[number]);
    if (members.some((p) => p?.seg?.some((s) => s.fx === 9))) return rainbow;
    return presetBackground(members.find(Boolean));
}
