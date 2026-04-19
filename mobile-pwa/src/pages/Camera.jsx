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

        reloadPage();
    }, [cameraStatus?.enabled, streamEnabled]);

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

            {/* Camera Status */}
            <div className="card">
                <div className="card-header">
                    <span className="card-icon">🎛️</span>
                    <h2>ESP32 Console Status</h2>
                </div>

                {loading ? (
                    <div className="loading">Loading sensor status...</div>
                ) : !cameraStatus ? (
                    <div className="error-box">
                        <p>⚠️ Data service is not available</p>
                    </div>
                ) : (
                    <div className="camera-status">
                        <div className="info-box" style={{ marginBottom: "15px" }}>
                            <p>
                                💡 Motion-triggered standby is disabled. Hold button 1 on the ESP32
                                console to enter standby, then press button 1 to wake the mirror.
                            </p>
                        </div>
                        <div className="status-grid">
                            <div className="status-item">
                                <span className="status-label">Standby</span>
                                <span className={`status-value ${cameraStatus.standby_active ? 'inactive' : 'active'}`}>
                                    {cameraStatus.standby_active ? '🌙 ACTIVE' : '☀️ AWAKE'}
                                </span>
                            </div>

                            <div className="status-item">
                                <span className="status-label">Camera Input</span>
                                <span className="status-value">
                                    {cameraStatus.enabled === false ? '⏸ DISABLED' : '📷 ENABLED'}
                                </span>
                            </div>
                        </div>
                        <div className="info-box">
                            <p>
                                {cameraStatus.standby_hint || 'Standby is controlled manually from the ESP32 console or dashboard.'}
                            </p>
                        </div>
                    </div>
                )}
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
                            Enable to preview your camera orientation.
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
                                        ? 'Camera is off. Waiting for it to come back on...'
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
