import React, { useState, useEffect } from 'react';
import './Camera.css';
import { apiFetch, getApiBase } from '../api/apiClient';

export default function Camera() {
    const [cameraStatus, setCameraStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [streamEnabled, setStreamEnabled] = useState(false);
    const [streamUrl, setStreamUrl] = useState('');
    const [streamError, setStreamError] = useState('');
    const [streamRetryCount, setStreamRetryCount] = useState(0);

    function reloadPage() {
        window.location.reload();
    }

    async function startStream(keepEnabledOnFailure = false) {
        try {
            setStreamError('');
            const response = await apiFetch('/api/auth/stream-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'camera_raw' })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.token) {
                throw new Error(data.error || 'Failed to create stream token');
            }

            const query = new URLSearchParams({
                streamToken: data.token,
                _: String(Date.now()),
            });
            setStreamUrl(`${getApiBase()}/api/camera/raw?${query.toString()}`);
            setStreamEnabled(true);
            setStreamRetryCount(0);
        } catch (error) {
            setStreamEnabled(keepEnabledOnFailure);
            setStreamError(error.message || 'Failed to load stream');
            setStreamRetryCount((current) => current + 1);
            console.error('Failed to start stream:', error);
        }
    }

    useEffect(() => {
        loadCameraStatus();
        const interval = setInterval(loadCameraStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!streamEnabled || !streamError || cameraStatus?.enabled === false) {
            return undefined;
        }

        const retryDelayMs = Math.min(1000 * (streamRetryCount + 1), 5000);
        const timeout = setTimeout(() => {
            startStream(true);
        }, retryDelayMs);

        return () => clearTimeout(timeout);
    }, [cameraStatus?.enabled, streamEnabled, streamError, streamRetryCount]);

    useEffect(() => {
        if (!streamEnabled || cameraStatus?.enabled !== false) {
            return;
        }

        setStreamUrl('');
        setStreamError('Camera input is disabled');
        setStreamRetryCount(0);
    }, [cameraStatus?.enabled, streamEnabled]);

    useEffect(() => {
        if (!streamEnabled) {
            return undefined;
        }

        const refreshTimer = setInterval(() => {
            startStream(true);
        }, 4 * 60 * 1000);

        return () => clearInterval(refreshTimer);
    }, [streamEnabled]);

    const loadCameraStatus = async () => {
        try {
            const response = await apiFetch('/api/camera/status');
            const data = await response.json();
            setCameraStatus(data);
        } catch (error) {
            console.error('Failed to load camera status:', error);
        } finally {
            setLoading(false);
        }
    };

    const disableStream = () => {
        reloadPage();
    };

    const streamDetails = cameraStatus?.stream_resolution
        ? `${cameraStatus.stream_resolution.width}x${cameraStatus.stream_resolution.height}`
        : 'optimized preview';

    return (
        <div className="page">
            <div className="page-header">
                <h1>ESP32 Console & Camera</h1>
            </div>

            {/* Live Camera Feed */}
            <div className="card">
                <div className="card-header">
                    <span className="card-icon">📹</span>
                    <h2>Live Stream Proxy Feed</h2>
                </div>

                <div className="camera-feed">
                    <div className="info-box">
                        <p>
                            💡 Video streaming natively proxies an MJPEG stream without AI processing.
                            Enable to preview your camera orientation. Hold button 1 for standby,
                            then press button 1 to wake.
                        </p>
                    </div>

                    <button
                        className={`stream-button ${streamEnabled ? 'enabled' : 'disabled'}`}
                        onClick={streamEnabled ? disableStream : startStream}
                    >
                        <span className="button-icon">
                            {streamEnabled ? '⏹' : '▶'}
                        </span>
                        {streamEnabled ? 'Stop Video Stream' : `Start Video Stream (${streamDetails})`}
                    </button>

                    {streamEnabled && (
                        <div className="feed-container">
                            {cameraStatus?.enabled === false || streamError ? (
                                <div className="feed-error">
                                    {cameraStatus?.enabled === false
                                        ? 'Camera input is disabled from the dashboard.'
                                        : 'Reconnecting to camera stream...'}
                                </div>
                            ) : (
                                <img
                                    src={streamUrl}
                                    alt="Live Camera Feed"
                                    className="video-feed"
                                    onLoad={() => {
                                        setStreamError('');
                                        setStreamRetryCount(0);
                                    }}
                                    onError={() => {
                                        setStreamUrl('');
                                        setStreamError('Stream load error');
                                        setStreamRetryCount((current) => current + 1);
                                        console.error('Stream load error');
                                    }}
                                />
                            )}
                            <div className="feed-status">
                                <span className="live-indicator">🔴 LIVE</span>
                                <span>MJPEG Proxy Feed</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
