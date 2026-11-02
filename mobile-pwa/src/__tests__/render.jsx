import React from 'react';
import { render as baseRender } from '@testing-library/react';
import { NexusTheme } from '../components/NexusTheme';
export function render(ui, options) {
    return baseRender(<NexusTheme>{ui}</NexusTheme>, options);
}
