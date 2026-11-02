import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from 'react';
import { apiRequest, getApiBase } from '../api/apiClient';
import { useNexusControllers } from './useNexusControllers';
const NexusContext = createContext(null);
const endpoints = {
    console: '/api/console/state',
    settings: '/api/settings',
    sensor: '/api/sensor',
    clock: '/api/clock/state',
    history: '/api/clock/history',
    lights: '/api/lights',
    devices: '/api/devices',
    activity: '/api/activity',
    config: '/api/nexus/config'
};
export function NexusProvider({ children }) {
    const [data, setData] = useState({});
    const [errors, setErrors] = useState({});
    const [connected, setConnected] = useState(false);
    const active = useRef(true);
    const refresh = useCallback(async (key) => {
        await Promise.all(
            (key ? [key] : Object.keys(endpoints)).map(async (name) => {
                try {
                    const value = await apiRequest(endpoints[name]);
                    if (active.current) {
                        setData((previous) => ({ ...previous, [name]: value }));
                        setErrors((previous) => ({
                            ...previous,
                            [name]: null
                        }));
                    }
                } catch (error) {
                    if (active.current)
                        setErrors((previous) => ({
                            ...previous,
                            [name]: error.message
                        }));
                }
            })
        );
    }, []);
    const commands = useNexusControllers({
        data,
        errors,
        connected,
        request: apiRequest,
        refresh
    });
    useEffect(() => {
        active.current = true;
        let socket;
        let retry;
        let stopped = false;
        function connect() {
            if (stopped) return;
            const url = new URL(getApiBase());
            url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            socket = new WebSocket(url);
            socket.onopen = () => {
                if (!stopped) {
                    setConnected(true);
                    refresh();
                }
            };
            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'clock_event') {
                        setData((previous) => ({
                            ...previous,
                            clockEvent: message.data
                        }));
                        return;
                    }
                    if (message.type === 'activity_event') {
                        setData((previous) => ({
                            ...previous,
                            activity: {
                                entries: [
                                    message.data,
                                    ...(previous.activity?.entries || [])
                                ].slice(0, 500)
                            }
                        }));
                        return;
                    }
                    const key = {
                        console_state: 'console',
                        settings_update: 'settings',
                        nexus_config: 'config',
                        clock_state: 'clock',
                        lights_state: 'lights',
                        devices_state: 'devices',
                        sensor_data: 'sensor'
                    }[message.type];
                    if (key) {
                        setErrors((previous) => ({ ...previous, [key]: null }));
                        setData((previous) => ({
                            ...previous,
                            [key]:
                                key === 'lights'
                                    ? {
                                          ...previous.lights,
                                          lights: message.data
                                      }
                                    : key === 'devices'
                                      ? { devices: message.data }
                                      : message.data,
                            ...(key === 'clock' ? { clockEvent: null } : {})
                        }));
                    }
                } catch (_) {
                    /* Ignore malformed messages. */
                }
            };
            socket.onclose = () => {
                if (!stopped) {
                    setConnected(false);
                    retry = setTimeout(connect, 5000);
                }
            };
            socket.onerror = () => socket.close();
        }
        refresh();
        connect();
        const interval = setInterval(() => {
            if (!document.hidden) refresh();
        }, 15000);
        const visibility = () => {
            if (!document.hidden) refresh();
        };
        document.addEventListener('visibilitychange', visibility);
        return () => {
            active.current = false;
            stopped = true;
            clearTimeout(retry);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', visibility);
            socket?.close();
        };
    }, [refresh]);
    return (
        <NexusContext.Provider
            value={{
                data,
                errors,
                connected,
                refresh,
                request: apiRequest,
                commands
            }}
        >
            {children}
        </NexusContext.Provider>
    );
}
export function useNexus() {
    return useContext(NexusContext);
}
