import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NexusTheme, useNexusAppearance } from '../components/NexusTheme';
function Preference() {
    const { appearance, setAppearance } = useNexusAppearance();
    return (
        <button onClick={() => setAppearance('system')}>{appearance}</button>
    );
}
afterEach(() => localStorage.clear());
describe('Relay appearance preference', () => {
    it('defaults new users to dark and retains saved light and system choices', () => {
        localStorage.clear();
        let view = render(
            <NexusTheme>
                <Preference />
            </NexusTheme>
        );
        expect(screen.getByRole('button')).toHaveTextContent('dark');
        expect(document.documentElement).toHaveAttribute(
            'data-mantine-color-scheme',
            'dark'
        );
        view.unmount();
        localStorage.setItem('nexus-theme', 'light');
        view = render(
            <NexusTheme>
                <Preference />
            </NexusTheme>
        );
        expect(screen.getByRole('button')).toHaveTextContent('light');
        expect(document.documentElement).toHaveAttribute('data-theme', 'light');
        fireEvent.click(screen.getByRole('button'));
        expect(localStorage.getItem('nexus-theme')).toBe('system');
        expect(document.documentElement).toHaveAttribute(
            'data-theme',
            'system'
        );
    });
});
