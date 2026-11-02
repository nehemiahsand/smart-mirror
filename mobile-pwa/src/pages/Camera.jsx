import React, { useEffect, useRef, useState } from 'react';
import { VideoOff } from 'lucide-react';
import { apiRequest, getApiBase } from '../api/apiClient';
import { Button, Notice, Status, Switch } from '../components/NexusUI';

export default function Camera() {
    const [enabled, setEnabled] = useState(null);
    const [visible, setVisible] = useState(!document.hidden);
    const [url, setUrl] = useState('');
    const [phase, setPhase] = useState('connecting');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [retry, setRetry] = useState(0);
    const [resolution, setResolution] = useState('');
    const active = useRef(true);
    const firstFrame = useRef(false);
    const reconnect = useRef();
    const attempts = useRef(0);
    const enabledRef = useRef(null);
    enabledRef.current = enabled;
    useEffect(() => {
        const visibility = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', visibility);
        return () => document.removeEventListener('visibilitychange', visibility);
    }, []);
    useEffect(() => {
        active.current = true;
        if (!visible) { setUrl(''); setPhase('paused'); return; }
        const controller = new AbortController();
        let stopped = false;
        let renewal;
        let timeout;
        setPhase('connecting');
        setError('');
        firstFrame.current = false;
        performance.mark?.('nexus-camera-start');
        // Privacy is authoritative and inexpensive. Sidecar diagnostics must not
        // delay mounting the preview (especially while USB wakes from standby).
        apiRequest('/api/camera/status', undefined, { signal: controller.signal }).then((result) => {
            if (!stopped && result.stream_resolution)
                setResolution(`${result.stream_resolution.width} × ${result.stream_resolution.height}`);
        }).catch(() => {});
        async function start() {
            try {
                const [privacy, result] = await Promise.all([
                    apiRequest('/api/privacy/status', undefined, { signal: controller.signal }),
                    apiRequest('/api/auth/stream-token', { scope: 'camera_raw' }, { signal: controller.signal }).catch((error) => ({ error }))
                ]);
                if (stopped) return;
                performance.mark?.('nexus-camera-authorized');
                if (typeof privacy.cameraEnabled !== 'boolean') throw new Error('Camera privacy status is unavailable.');
                setEnabled(privacy.cameraEnabled);
                if (privacy.cameraEnabled !== true) {
                    setUrl(''); setPhase('disabled'); return;
                }
                if (result.error) throw result.error;
                if (typeof result.token !== 'string' || !result.token) throw new Error('Camera access token unavailable.');
                setUrl(`${getApiBase()}/api/camera/raw?${new URLSearchParams({ streamToken: result.token, _: Date.now() })}`);
                renewal = setTimeout(start, 240000);
                timeout = setTimeout(() => {
                    if (!stopped && !firstFrame.current) {
                        setPhase('failed');
                        setError('No camera frame received yet. The camera may be waking from standby.');
                    }
                }, 12000);
            } catch (e) {
                if (!stopped && e.name !== 'AbortError') { setError(e.message); setPhase('failed'); }
            }
        }
        start();
        // Refresh privacy while viewing without reconnecting a healthy stream.
        const poll = setInterval(async () => {
            try {
                const result = await apiRequest('/api/privacy/status', undefined, { signal: controller.signal });
                if (stopped) return;
                if (result.cameraEnabled === false) { setEnabled(false); setUrl(''); setPhase('disabled'); }
                else if (result.cameraEnabled === true && enabledRef.current === false) setRetry((n) => n + 1);
            } catch (_) { /* Keep current preview; initial and stream failures remain visible. */ }
        }, 10000);
        return () => {
            active.current = false; stopped = true; controller.abort();
            clearInterval(poll); clearTimeout(renewal); clearTimeout(timeout); clearTimeout(reconnect.current);
        };
    }, [visible, retry]);
    async function privacy() {
        setBusy(true);
        try {
            await apiRequest('/api/privacy', { cameraEnabled: !enabled });
            if (!active.current) return;
            setEnabled(!enabled);
            setRetry((n) => n + 1);
        } catch (e) { if (active.current) setError(e.message); }
        finally { if (active.current) setBusy(false); }
    }
    return <>
        <div className="row camera-toolbar">
            <div><h2>Mirror camera</h2><small>Preview stops when you leave this view.</small></div>
            <div className="row"><span>Camera input</span><Switch label="Camera input" checked={enabled} disabled={enabled === null || busy} onChange={privacy} /></div>
        </div>
        <div className="row camera-status-row"><Status online={phase === 'live'}>{({ live: 'Live preview', disabled: 'Camera disabled', paused: 'Preview paused', failed: 'Stream unavailable', connecting: 'Connecting' })[phase]}</Status>
            {phase === 'failed' && <Button onClick={() => { attempts.current = 0; setRetry((n) => n + 1); }}>Retry preview</Button>}
        </div>
        <div className={`camera-preview camera-${phase}`}>
            {url && visible && enabled ? <img key={url} src={url} alt="Live mirror camera"
                onLoad={() => { attempts.current = 0; firstFrame.current = true; setPhase('live'); setError(''); performance.mark?.('nexus-camera-first-frame'); }}
                onError={() => { setUrl(''); setError('Camera stream unavailable. Retry the preview after checking the connection.'); setPhase('failed'); if (active.current && !document.hidden && attempts.current < 3) { attempts.current += 1; reconnect.current = setTimeout(() => setRetry((n) => n + 1), 2000); } }} />
                : <div><VideoOff /><p>{phase === 'disabled' ? 'Camera input is disabled' : !visible ? 'Preview paused' : phase === 'failed' ? 'Unable to start the preview' : 'Waiting for the first camera frame…'}</p></div>}
            {url && phase === 'connecting' && <div className="camera-loading-label">Connecting · Waiting for first frame…</div>}
        </div>
        <p className="hint">{resolution || 'Resolution unavailable'} · Authenticated camera preview</p>
        <Notice error={error} />
    </>;
}
