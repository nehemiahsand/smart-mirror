import { it, expect } from 'vitest';
import { presetBackground, savedPresets, pairBackground } from '../utils/lightPresets';
it('shows blue-left red-right Star Wars and actual saved segment colors', () => {
    expect(presetBackground({ n: 'Star Wars' })).toMatch(/#0000ff.*#ff0000/);
    expect(presetBackground({ seg: [{ col: [[255, 214, 160]] }] })).toContain('rgb(255,214,160)');
    expect(savedPresets({ presets: { 0: {}, 2: { n: 'Star Wars' }, 251: {} } })).toHaveLength(1);
});
it('renders an explicitly mapped Rainbow / Gaming pair using its animated effect', () => {
    const pair = { devices: { desk: 6, monitor: 3 } };
    expect(pairBackground(pair, [{ id: 'desk', presets: { 6: { seg: [{ fx: 9 }] } } }, { id: 'monitor', presets: { 3: { seg: [{ fx: 9 }] } } }])).toContain('linear-gradient');
});
