import React, { createContext, useContext, useEffect, useState } from 'react';
import { createTheme, MantineProvider } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import '@mantine/core/styles.css';

const AppearanceContext = createContext(null);
const theme = createTheme({
    primaryColor: 'nexus',
    colors: {
        nexus: [
            '#fff2e6',
            '#ffdfc0',
            '#ffc38e',
            '#ff9c58',
            '#f58b3c',
            '#e27421',
            '#c75b12',
            '#a14317',
            '#843b1b',
            '#6b311a'
        ]
    },
    primaryShade: { light: 7, dark: 3 },
    defaultRadius: 'sm',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSizes: { xs: '0.75rem', sm: '0.875rem', md: '0.9375rem' },
    headings: { fontFamily: 'inherit' },
    focusRing: 'auto'
});
function savedAppearance() {
    const saved = localStorage.getItem('nexus-theme');
    return ['light', 'dark', 'system'].includes(saved) ? saved : 'dark';
}
export function NexusTheme({ children }) {
    const [appearance, setPreference] = useState(savedAppearance);
    const systemDark = useMediaQuery('(prefers-color-scheme: dark)', false, {
        getInitialValueInEffect: false
    });
    const scheme =
        appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance;
    function setAppearance(value) {
        if (!['light', 'dark', 'system'].includes(value)) return;
        localStorage.setItem('nexus-theme', value);
        setPreference(value);
    }
    useEffect(() => {
        document.documentElement.dataset.theme = appearance;
    }, [appearance]);
    useEffect(() => {
        const sync = (event) => {
            if (event.key === 'nexus-theme') setPreference(savedAppearance());
        };
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);
    return (
        <AppearanceContext.Provider value={{ appearance, setAppearance }}>
            <MantineProvider theme={theme} forceColorScheme={scheme}>
                <LazyMotion features={domMax} strict>
                    <MotionConfig reducedMotion="user">{children}</MotionConfig>
                </LazyMotion>
            </MantineProvider>
        </AppearanceContext.Provider>
    );
}
export function useNexusAppearance() {
    return useContext(AppearanceContext);
}
