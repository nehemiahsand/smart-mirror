import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import { useWebSocket } from './hooks/useWebSocket';
import { useLayoutEngine } from './hooks/useLayoutEngine';
import TimeDateWidget from './widgets/TimeDate';
import WeatherTempWidget from './widgets/WeatherTemp';
import WeatherTrafficWidget from './widgets/WeatherTraffic';
import GoogleCalendarWidget from './widgets/GoogleCalendar';
import PhotosWidget from './widgets/Photos';
import TrafficWidget from './widgets/Traffic';
import SportsScores from './widgets/SportsScores';
import MessageOverlay from './components/MessageOverlay';
import StatusIndicator from './components/StatusIndicator';
import LayoutContainer from './components/LayoutContainer';
import StandbyMode from './components/StandbyMode';
import SpotifyPlayer from './components/SpotifyPlayer';

function App() {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentPage, setCurrentPage] = useState(() => {
        // Restore page state from localStorage
        return localStorage.getItem('currentPage') || 'home';
    });
    const [isJarvisListening, setIsJarvisListening] = useState(false);

    // WebSocket with page change handler
    const handlePageChange = useCallback((page) => {
        console.log('Page change requested:', page);
        setCurrentPage(page);
        localStorage.setItem('currentPage', page);
    }, []);

    const handleListeningChange = useCallback((listening) => {
        console.log('Jarvis listening:', listening);
        console.log('Setting isJarvisListening to:', listening);
        setIsJarvisListening(listening);
    }, []);

    const {
        isConnected,
        time,
        sensorData,
        weatherData,
        settings,
        message
    } = useWebSocket(handlePageChange, handleListeningChange);

    // Initialize layout engine
    const {
        getWidgetStyle,
        isWidgetEnabled,
        isAnimating
    } = useLayoutEngine(settings);

    useEffect(() => {
        // Apply theme from settings
        if (settings?.display?.theme) {
            document.body.setAttribute('data-theme', settings.display.theme);
        }

        // Apply layout from settings
        if (settings?.display?.layout) {
            document.body.setAttribute('data-layout', settings.display.layout);
        }

        // Toggle fullscreen with F key
        const handleKeyPress = (e) => {
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                toggleFullscreen();
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        // Auto-enter fullscreen on first click
        const handleFirstClick = () => {
            if (!isFullscreen) {
                enterFullscreen();
                window.removeEventListener('click', handleFirstClick);
            }
        };
        window.addEventListener('click', handleFirstClick);

        return () => {
            window.removeEventListener('keydown', handleKeyPress);
            window.removeEventListener('click', handleFirstClick);
        };
    }, [settings, isFullscreen]);

    // Fullscreen functions
    const enterFullscreen = () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().then(() => setIsFullscreen(true));
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
            setIsFullscreen(true);
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
            setIsFullscreen(true);
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
            setIsFullscreen(true);
        }
    };

    const exitFullscreen = () => {
        if (document.exitFullscreen) {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
            setIsFullscreen(false);
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
            setIsFullscreen(false);
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
            setIsFullscreen(false);
        }
    };

    const toggleFullscreen = () => {
        if (isFullscreen) {
            exitFullscreen();
        } else {
            enterFullscreen();
        }
    };

    // Save layout to Raspberry Pi via POST /api/settings
    const handleSaveLayout = async (layoutData) => {
        try {
            const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${baseURL}/api/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(layoutData)
            });

            if (!response.ok) {
                throw new Error('Failed to save layout');
            }

            const result = await response.json();
            console.log('Layout saved successfully:', result);

            // Changes will be broadcast via WebSocket automatically
            return result;
        } catch (error) {
            console.error('Error saving layout:', error);
            throw error;
        }
    };

    // Determine which widgets to show based on settings
    const showWidget = (widgetName) => {
        if (!settings?.widgets) return true; // Show all by default
        return settings.widgets[widgetName] !== false;
    };

    // Get widget order from settings or use default
    const getWidgetOrder = (widgetId) => {
        if (!settings?.widgetOrder || !Array.isArray(settings.widgetOrder)) {
            return 0; // Default order
        }
        const index = settings.widgetOrder.indexOf(widgetId);
        return index === -1 ? 999 : index; // Put unknown widgets at the end
    };

    // Check if standby mode is enabled
    const isStandbyMode = settings?.display?.standbyMode === true;

    // Wait for settings to load before rendering (prevents widgets from loading when in standby)
    if (!settings) {
        return <div className="mirror" style={{ background: '#000' }}></div>;
    }

    // If in standby mode, show only the standby screen
    if (isStandbyMode) {
        return <StandbyMode />;
    }

    // Page navigation
    const goToHome = () => setCurrentPage('home');
    const goToSpotify = () => setCurrentPage('spotify');

    // Page indicator component
    const PageIndicator = () => (
        <div className="page-indicator">
            <div className={`page-dot ${currentPage === 'home' ? 'active' : ''}`} />
            <div className={`page-dot ${currentPage === 'spotify' ? 'active' : ''}`} />
        </div>
    );

    // Render Spotify page
    if (currentPage === 'spotify') {
        return (
            <>
                <SpotifyPlayer onGoHome={goToHome} />
                <PageIndicator />
            </>
        );
    }

    // Render Home page
    return (
        <div className="mirror">
            {/* Jarvis listening glow effect */}
            {isJarvisListening && <div className="jarvis-glow"></div>}

            <div className={`mirror-content vertical-layout ${isAnimating ? 'animating' : ''}`}>
                {/* Dynamic Layout - Combined widgets for better organization */}

                {/* Time & Date - Top */}
                {(isWidgetEnabled('clock') || isWidgetEnabled('date') || isWidgetEnabled('timedate')) && (
                    <div className="widget-section top" style={{ order: getWidgetOrder('timedate') }}>
                        <TimeDateWidget />
                    </div>
                )}

                {/* Google Calendar - Below Time/Date */}
                {(isWidgetEnabled('calendar') || isWidgetEnabled('googlecalendar') || isWidgetEnabled('sports') || isWidgetEnabled('nba')) && (
                    <div className="widget-section middle calendar-nba-row" style={{ order: getWidgetOrder('googlecalendar') }}>
                        {(isWidgetEnabled('calendar') || isWidgetEnabled('googlecalendar')) && (
                            <div className="calendar-widget">
                                <GoogleCalendarWidget />
                            </div>
                        )}
                        {(isWidgetEnabled('sports') || isWidgetEnabled('nba')) && (
                            <div className="nba-widget">
                                <SportsScores
                                    sport={settings?.sports?.sport || 'nba'}
                                    teams={settings?.sports?.teams || settings?.nba?.teams || []}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Weather & Temperature & Traffic - Middle (Combined) */}
                {(isWidgetEnabled('weathertemp') || isWidgetEnabled('traffic')) && (
                    <div className="widget-section middle" style={{ order: getWidgetOrder('weathertemp') }}>
                        <WeatherTrafficWidget weatherData={weatherData} sensorData={sensorData} />
                    </div>
                )}

                {/* Photos - Bottom */}
                {isWidgetEnabled('photos') && (
                    <div className="widget-section photos" style={{ order: getWidgetOrder('photos'), flex: 1 }}>
                        <PhotosWidget rotationInterval={(settings?.photos?.interval || 10) * 1000} />
                    </div>
                )}
            </div>

            {/* Message Overlay */}
            <MessageOverlay message={message} />

            {/* Connection Status */}
            <StatusIndicator isConnected={isConnected} />

            {/* Page Indicator */}
            <PageIndicator />
        </div>
    );
}

export default App;
