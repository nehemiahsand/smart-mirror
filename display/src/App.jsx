import React, { useEffect, useState, useCallback } from 'react';
import './App.css';
import { useWebSocket } from './hooks/useWebSocket';
import { useLayoutEngine } from './hooks/useLayoutEngine';
import TimeDateWidget from './widgets/TimeDate';
import WeatherTrafficWidget from './widgets/WeatherTraffic';
import GoogleCalendarWidget from './widgets/GoogleCalendar';
import PhotosWidget from './widgets/Photos';
import SportsScores from './widgets/SportsScores';
import MessageOverlay from './components/MessageOverlay';
import StatusIndicator from './components/StatusIndicator';
import PageIndicator from './components/PageIndicator';
import StandbyMode from './components/StandbyMode';
import SpotifyPlayer from './components/SpotifyPlayer';
import FunPage from './components/FunPage';

const DISPLAY_PAGES = ['home', 'fun', 'spotify'];
const DEFAULT_PAGE = 'home';

function normalizePage(page) {
    return DISPLAY_PAGES.includes(page) ? page : DEFAULT_PAGE;
}

function App() {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentPage, setCurrentPage] = useState(() => normalizePage(localStorage.getItem('currentPage')));
    const [isJarvisListening, setIsJarvisListening] = useState(false);

    // WebSocket with page change handler
    const handlePageChange = useCallback((page) => {
        const normalizedPage = normalizePage(page);
        console.log('Page change requested:', normalizedPage);
        setCurrentPage(normalizedPage);
        localStorage.setItem('currentPage', normalizedPage);
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
        consolePageData,
        settings,
        message,
        syncPage
    } = useWebSocket(handlePageChange, handleListeningChange);

    useEffect(() => {
        syncPage(currentPage);
    }, [currentPage, syncPage]);

    // Initialize layout engine
    const {
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

    // Render Spotify page
    if (currentPage === 'spotify') {
        return (
            <>
                <SpotifyPlayer />
                <PageIndicator pages={DISPLAY_PAGES} currentPage={currentPage} />
            </>
        );
    }

    if (currentPage === 'fun') {
        return (
            <>
                <FunPage pageData={consolePageData.fun} />
                <PageIndicator pages={DISPLAY_PAGES} currentPage={currentPage} />
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
            <PageIndicator pages={DISPLAY_PAGES} currentPage={currentPage} />
        </div>
    );
}

export default App;
