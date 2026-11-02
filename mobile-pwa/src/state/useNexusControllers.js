import { useCallback, useEffect, useRef, useState } from 'react';

// Lives above routes so navigation cannot reset an in-flight command lock.
export function useNexusControllers({
    data,
    errors,
    connected,
    request,
    refresh
}) {
    const current = useRef();
    current.current = { data, errors, connected };
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const [mirrorState, setMirrorState] = useState({
        pending: false,
        error: '',
        message: ''
    });
    const mirrorLock = useRef(false);
    const mirrorAvailable = () => {
        const { data, errors, connected } = current.current;
        const host = data.devices?.devices?.find(
            (device) => device.id === 'mirror'
        );
        return !!(
            connected &&
            data.console &&
            !errors.console &&
            (!host || host.online)
        );
    };
    const runMirror = useCallback(
        async (path, body) => {
            if (!mounted.current || mirrorLock.current || !mirrorAvailable())
                return false;
            mirrorLock.current = true;
            setMirrorState({ pending: true, error: '', message: '' });
            try {
                await request(path, body);
                await refresh('console');
                if (mounted.current)
                    setMirrorState({
                        pending: false,
                        error: '',
                        message: 'Request acknowledged.'
                    });
                return true;
            } catch (error) {
                if (mounted.current)
                    setMirrorState({
                        pending: false,
                        error: error.message,
                        message: ''
                    });
                return false;
            } finally {
                mirrorLock.current = false;
            }
        },
        [request, refresh]
    );
    const [lightingState, setLightingState] = useState({
        pending: {},
        error: '',
        message: ''
    });
    const queues = useRef({});
    const running = useRef(new Set());
    const sendLight = useCallback(
        async function send(id, body) {
            const state = current.current;
            const lights = state.data.lights?.lights || [];
            if (!mounted.current || !state.connected || state.errors.lights)
                return false;
            if (
                id === 'all'
                    ? !lights.some((light) => light.online)
                    : !lights.some((light) => light.id === id && light.online)
            )
                return false;
            if (
                id === 'all'
                    ? [...running.current].some((key) => key !== 'all')
                    : running.current.has('all')
            )
                return false;
            queues.current[id] = { ...queues.current[id], ...body };
            if (running.current.has(id)) return false;
            running.current.add(id);
            setLightingState((previous) => ({
                ...previous,
                pending: { ...previous.pending, [id]: true },
                error: '',
                message: ''
            }));
            let error = '';
            let message = '';
            try {
                let result;
                while (queues.current[id] && mounted.current) {
                    const next = queues.current[id];
                    delete queues.current[id];
                    result = await request(
                        id === 'all'
                            ? '/api/lights/group'
                            : `/api/lights/${id}/command`,
                        next
                    );
                }
                if (!mounted.current) return false;
                if (id === 'all' && result.results.some((item) => !item.ok)) {
                    error = result.results
                        .map(
                            (item) =>
                                `${lights.find((light) => light.id === item.id)?.name || item.id}: ${item.ok ? 'updated' : item.error}`
                        )
                        .join(' · ');
                } else
                    message =
                        id === 'all'
                            ? 'Lighting group updated.'
                            : `${lights.find((light) => light.id === id)?.name || id} updated.`;
                await refresh('lights');
                return !error;
            } catch (failure) {
                delete queues.current[id];
                error = failure.message;
                // Reconcile boards even if a transport error followed a partial change.
                await refresh('lights');
                return false;
            } finally {
                running.current.delete(id);
                if (mounted.current) {
                    setLightingState((previous) => ({
                        pending: { ...previous.pending, [id]: false },
                        error,
                        message
                    }));
                    if (queues.current[id]) send(id, {});
                }
            }
        },
        [request, refresh]
    );
    return {
        mirror: {
            ...mirrorState,
            available: mirrorAvailable(),
            run: runMirror
        },
        lighting: { ...lightingState, send: sendLight }
    };
}
