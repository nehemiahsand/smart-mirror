import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NexusTheme } from '../components/NexusTheme';
const mocks = vi.hoisted(() => ({
    data: { settings: { weather: { city: 'Birmingham,US', units: 'imperial' }, sports: { highlightsTeam: 'gsw', livePriority: ['auburn', 'gsw'] } } },
    request: vi.fn(async () => ({})), refresh: vi.fn(async () => {})
}));
vi.mock('../state/NexusProvider', () => ({ useNexus: () => mocks }));
vi.mock('react-router-dom', async (original) => ({ ...(await original()), useBlocker: () => ({ state: 'unblocked' }) }));
import MirrorEdit from '../pages/MirrorEdit';
it('follows saved console team changes without overwriting an unsaved edit', async () => {
    const view = () => <NexusTheme><MemoryRouter initialEntries={['/mirror/edit?section=sports']}><MirrorEdit /></MemoryRouter></NexusTheme>;
    const { rerender } = render(view());
    const select = await screen.findByRole('combobox', { name: 'Highlights team' });
    expect(select).toHaveValue('gsw');
    mocks.data = { settings: { ...mocks.data.settings, sports: { ...mocks.data.settings.sports, highlightsTeam: 'auburn' } } };
    rerender(view());
    await waitFor(() => expect(select).toHaveValue('auburn'));
    fireEvent.change(select, { target: { value: 'gsw' } });
    mocks.data = { settings: { ...mocks.data.settings, weather: { ...mocks.data.settings.weather, units: 'metric' } } };
    rerender(view());
    expect(select).toHaveValue('gsw');
});
