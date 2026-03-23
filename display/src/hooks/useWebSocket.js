import { useState, useEffect, useCallback, useRef } from 'react';

function getDefaultWsUrl() {
  if (typeof window === 'undefined') {
    return 'ws://localhost';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}`;
}

const BASE_WS_URL = import.meta.env.VITE_WS_URL || getDefaultWsUrl();
const ALLOWED_PAGES = new Set(['home', 'fun', 'spotify']);

function normalizePage(page) {
  return ALLOWED_PAGES.has(page) ? page : 'home';
}

export const useWebSocket = (onPageChange, onListeningChange) => {
  const [isConnected, setIsConnected] = useState(false);
  const [time, setTime] = useState(null);
  const [sensorData, setSensorData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [consolePageData, setConsolePageData] = useState({});
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const previousStandbyMode = useRef(null);
  const settingsRef = useRef(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(BASE_WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Always process settings updates (needed to wake from standby)
          if (data.type === 'settings_update') {
            const newStandbyMode = data.data?.display?.standbyMode;
            const wasInStandby = previousStandbyMode.current === true;
            const nowActive = newStandbyMode === false;
            
            // If transitioning from standby to active, refresh the display
            if (wasInStandby && nowActive) {
              console.log('Exiting standby mode - refreshing display');
              setTimeout(() => window.location.reload(), 100);
            }
            
            previousStandbyMode.current = newStandbyMode;
            settingsRef.current = data.data;
            setSettings(data.data);
            return;
          }
          
          // In standby mode, ignore all other messages to minimize CPU usage
          // We check settings here because it might be null on first load
          if (settingsRef.current?.display?.standbyMode === true) {
            return;
          }
          
          switch (data.type) {
            case 'time':
              setTime(data.data);
              break;
            case 'sensor_data':
              setSensorData(data.data);
              break;
            case 'weather_data':
              setWeatherData(data.data);
              break;
            case 'console_state':
              if (data.data?.activePageId && onPageChange) {
                onPageChange(normalizePage(data.data.activePageId));
              }
              break;
            case 'console_page_data':
              if (data.pageId) {
                setConsolePageData(prev => ({
                  ...prev,
                  [data.pageId]: data.data
                }));
              }
              break;
            case 'page_change':
            case 'voice_command':
              // Handle externally-triggered page changes
              if (data.page && onPageChange) {
                console.log('External command: changing page to', data.page);
                onPageChange(normalizePage(data.page));
              }
              break;
            case 'jarvis_listening':
              // Handle Jarvis listening state for visual feedback
              console.log('🎤 Jarvis listening state:', data.listening);
              if (onListeningChange) {
                onListeningChange(data.listening);
              }
              break;
            case 'layout_update':
              // Merge layout update into settings
              setSettings(prev => ({
                ...prev,
                layout: {
                  ...(prev?.layout || {}),
                  widgets: data.data.widgets
                }
              }));
              break;
            case 'theme_changed':
              if (data.data.theme) {
                document.body.setAttribute('data-theme', data.data.theme);
              }
              break;
            case 'layout_changed':
              if (data.data.layout) {
                document.body.setAttribute('data-layout', data.data.layout);
              }
              break;
            case 'display_message':
              setMessage(data.data);
              if (data.data.duration) {
                setTimeout(() => setMessage(null), data.data.duration);
              }
              break;
            case 'display_refresh':
              console.log('Display refresh requested');
              window.location.reload();
              break;
            case 'connected':
              console.log('WebSocket connection established:', data.message);
              break;
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    time,
    sensorData,
    weatherData,
    consolePageData,
    settings,
    message
  };
};
