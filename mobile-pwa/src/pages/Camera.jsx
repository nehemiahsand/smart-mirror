import React, { useState, useEffect } from 'react';
import './Camera.css';

const API_BASE = `http://${window.location.hostname}:3001`;

export default function Camera() {
    const [cameraStatus, setCameraStatus] = useState(null);
    const [autoStandby, setAutoStandby] = useState(true);
    const [loading, setLoading] = useState(true);
    const [streamEnabled, setStreamEnabled] = useState(false);

    useEffect(() => {
        loadCameraStatus();
        const interval = setInterval(loadCameraStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const loadCameraStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/camera/status`);
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
            const response = await fetch(`${API_BASE}/api/camera/auto-standby`, {
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

    const formatTime = (ms) => {
        if (!ms) return 'N/A';
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>Camera & AI Detection</h1>
            </div>

            {/* Camera Status */}
            <div className="card">
                <div className="card-header">
                    <span className="card-icon">🤖</span>
                    <h2>AI Person Detection</h2>
                </div>

                {loading ? (
                    <div className="loading">Loading camera status...</div>
                ) : !cameraStatus?.available ? (
                    <div className="error-box">
                        <p>⚠️ Camera service is not available</p>
                        <p className="error-detail">Make sure the camera is connected and the service is running</p>
                    </div>
                ) : (
                    <div className="camera-status">
                        <div className="status-grid">
                            <div className="status-item">
                                <span className="status-label">Person Detected</span>
                                <span className={`status-value ${cameraStatus.person_detected ? 'active' : 'inactive'}`}>
                                    {cameraStatus.person_detected ? '✅ YES' : '❌ NO'}
                                </span>
                            </div>

                            <div className="status-item">
                                <span className="status-label">Total Detections</span>
                                <span className="status-value">{cameraStatus.total_detections || 0}</span>
                            </div>

                            <div className="status-item">
                                <span className="status-label">Camera FPS</span>
                                <span className="status-value">{cameraStatus.fps || 0} fps</span>
                            </div>

                            <div className="status-item">
                                <span className="status-label">Time Until Standby</span>
                                <span className="status-value">
                                    {cameraStatus.person_detected
                                        ? '5m 0s'
                                        : formatTime(cameraStatus.time_until_standby)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Auto-Standby Control */}
            {cameraStatus?.available && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-icon">💤</span>
                        <h2>Auto-Standby Mode</h2>
                    </div>

                    <div className="auto-standby-control">
                        <div className="info-box">
                            <p>
                                When enabled, the mirror will automatically enter standby mode after 1 minute
                                of no person detected, and wake up when a person is detected.
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
            {cameraStatus?.available && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-icon">📹</span>
                        <h2>Live Camera Feed</h2>
                    </div>

                    <div className="camera-feed">
                        <div className="info-box">
                            <p>
                                💡 Video streaming uses significant CPU. Enable only when needed to conserve resources.
                            </p>
                        </div>

                        <button
                            className={`stream-button ${streamEnabled ? 'enabled' : 'disabled'}`}
                            onClick={() => {
                                const newState = !streamEnabled;
                                setStreamEnabled(newState);

                                // If turning OFF, refresh page to kill stream connection
                                if (!newState) {
                                    setTimeout(() => {
                                        window.location.reload();
                                    }, 100);
                                }
                            }}
                        >
                            <span className="button-icon">{streamEnabled ? '🎥' : '⏸️'}</span>
                            <span className="button-text">
                                Video Stream: {streamEnabled ? 'ON' : 'OFF'}
                            </span>
                        </button>

                        {streamEnabled ? (
                            <div className="video-container">
                                <img
                                    src={`${API_BASE}/api/camera/raw`}
                                    alt="Live camera feed"
                                    className="video-stream"
                                    onError={(e) => {
                                        console.error('Stream error:', e);
                                    }}
                                />
                                <div className="feed-info">
                                    <p>🟢 Live stream active (1280x720 HD)</p>
                                    <p className="feed-detail">
                                        AI detection continues in background regardless of stream status
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="stream-off-message">
                                <p>📹 Stream is off - click button above to view live feed</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
