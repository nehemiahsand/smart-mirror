import React from 'react';
import { it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render } from './render';
import MonitorActivity from '../pages/MonitorActivity';
it('identifies source devices and filters independent Event / Warning / Error types', () => {
    render(<MemoryRouter><MonitorActivity devices={[{ id: 'desk', name: 'Desk' }, { id: 'monitor', name: 'Monitor' }]} entries={[
        { id: '1', deviceId: 'desk', level: 'info', message: 'Preset applied', timestamp: Date.now() },
        { id: '2', deviceId: 'monitor', level: 'warning', message: 'Disconnected', timestamp: Date.now() },
        { id: '3', deviceId: 'monitor', level: 'error', message: 'Command failed', timestamp: Date.now() }
    ]} /></MemoryRouter>);
    expect(screen.getByText('Preset applied')).toBeInTheDocument();
    expect(screen.getAllByText('Warning')[0]).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Error' } });
    expect(screen.queryByText('Preset applied')).toBeNull();
    expect(screen.getByText('Command failed')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Device'), { target: { value: 'desk' } });
    expect(screen.getByText('No events match these filters.')).toBeInTheDocument();
});
