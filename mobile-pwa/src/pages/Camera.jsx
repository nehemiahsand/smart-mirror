import React, { useState, useEffect } from 'react';
import './Camera.css';
import { apiFetch, getApiBase } from '../apiClient';

export default function Camera() {
    const [cameraStatus, setCameraStatus] = useState(null);
    const [autoStandby, setAutoStandby] = useState(true);
    const [loading, setLoading] = useState(true);
    const [streamEnabled, setStreamEnabled] = useState(false);
    const [streamUrl, setStreamUrl] = useState('');

    useEffect(() => {
        loadCameraStatus();
        const interval = setInterval(loadCameraStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const loadCameraStatus = async () => {
        try {
            const response = await apiFetch('/api/camera/status');
            const data = await response.json();
            setCameraStatus(data);
            if (data.auto_standby_enabled !== undefined) {
                setAutoStandby(data.auto_standby_enabled);
            }
        } catch (error) {
            console.error('Failed to load camera status:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAutoStandby = async () => {
        try {
            const newValue = !autoStandby;
            const response = await apiFetch('/api/camera/auto-standby', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newValue })
            });

            if (response.ok) {
                setAutoStandby(newValue);
            }
        } catch (error) {
            console.error('Failed to toggle auto-standby:', error);
        }
    };

    const enableStream = async () => {
        try {
            const response = await apiFetch('/api/auth/stream-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'camera_raw' })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.token) {
                throw new Error(data.error || 'Failed to create stream token');
            }

            const query = new URLSearchParams({ streamToken: data.token });
            setStreamUrl(`${getApiBase()}/api/camera/raw?${query.toString()}`);
            setStreamEnabled(true);
        } catch (error) {
            console.error('Failed to enable stream:', error);
        }
    };

    const disableStream = () => {
        window.location.reload();
    };

    const formatTime = (ms) => {
        if (!ms) return 'N/A';
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    const streamDetails = cameraStatus?.stream_resolution
        ? `${cameraStatus.stream_resolution.width}x${cameraStatus.stream_resolution.height}`
        : 'optimized preview';

    return (
        <div className="page">
            <div className="page-header">
                <h1>Hardware Sensors & Camera</h1>
            </div>

            {/* Camera Status */}
            <div className="card">
                <div className="card-header">
                    <span className="card-icon">🏃‍♂️</span>
                    <h2>PIR Presence Detection</h2>
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
                                💡 Your mirror uses a hardware PIR motion sensor connected directly
                                to the ESP32 to detect presence instead of heavy AI logic.
                            </p>
                        </div>
                        <div className="status-grid">
                            <div className="status-item">
                                <span className="status-label">Person Detected</span>
                                <span className={`status-value ${cameraStatus.person_detected ? 'active' : 'inactive'}`}>
                                    {cameraStatus.person_detected ? '✅ YES' : '❌ NO'}
                                </span>
                            </div>

                            <div className="status-item">
                                <span className="status-label">Time Until Standby</span>
                                <span className="status-value">
                                    {cameraStatus.person_detected
                                        ? 'Paused while present'
                                        : formatTime(cameraStatus.time_until_standby)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Auto-Standby Control */}
            {cameraStatus && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-icon">💤</span>
                        <h2>Auto-Standby Mode</h2>
                    </div>

                    <div className="auto-standby-control">
                        <div className="info-box">
                            <p>
                                When enabled, the mirror will automatically enter standby mode after
                                no movement is reported from the ESP32 motion sensor.
                            </p>
                        </div>

                        <button
                            className={`standby-button ${autoStandby ? 'enabled' : 'disabled'}`}
                            onClick={toggleAutoStandby}
                        >
                            <span className="button-icon">{autoStandby ? '✓' : '✕'}</span>
                            <span className="button-text">
                                Auto-Standby: {autoStandby ? 'ON' : 'OFF'}
                            </span>
                        </button>
                    </div>
                </div>
            )}

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
                        onClick={streamEnabled ? disableStream : enableStream}
                    >
                        <span className="button-icon">
                            {streamEnabled ? '⏹' : '▶'}
                        </span>
                        {streamEnabled ? 'Stop Video Stream' : `Start Video Stream (${streamDetails})`}
                    </button>

                    {streamEnabled && (
                        <div className="feed-container">
                            <img
                                src={streamUrl}
                                alt="Live Camera Feed"
                                className="video-feed"
                                onError={(e) => {
                                    console.error('Stream load error');
                                    e.target.parentNode.innerHTML = '<div class="feed-error">Failed to load stream.<br/>Check container connection.</div>';
                                }}
                            />
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
