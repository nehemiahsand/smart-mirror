import React, { useState, useEffect } from 'react';
import TimeDateWidget from '../widgets/TimeDate';
import './SpotifyPlayer.css';

const API_BASE = `http://${window.location.hostname}:3001/api/spotify`;

export default function SpotifyPlayer({ onGoHome }) {
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [device, setDevice] = useState(null);
    const [context, setContext] = useState(null);

    // Check authentication status
    useEffect(() => {
        checkAuth();
    }, []);

    // Poll for current playback
    useEffect(() => {
        if (!isAuthenticated) return;

        fetchCurrentTrack();
        const interval = setInterval(fetchCurrentTrack, 2000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    const checkAuth = async () => {
        try {
            const response = await fetch(`${API_BASE}/status`);
            const data = await response.json();
            setIsAuthenticated(data.authenticated);
        } catch (error) {
            console.error('Error checking auth:', error);
        }
    };

    const fetchCurrentTrack = async () => {
        try {
            const response = await fetch(`${API_BASE}/player`);
            const data = await response.json();

            if (data.item) {
                setCurrentTrack({
                    name: data.item.name,
                    artist: data.item.artists.map(a => a.name).join(', '),
                    album: data.item.album.name,
                    albumArt: data.item.album.images[0]?.url,
                    duration: data.item.duration_ms
                });
                setIsPlaying(data.is_playing);
                setProgress(data.progress_ms || 0);
                setDuration(data.item.duration_ms);

                // Set device info
                if (data.device) {
                    setDevice(data.device.name);
                }

                // Set context (playlist/album)
                if (data.context) {
                    const contextType = data.context.type; // 'playlist', 'album', 'artist'
                    const contextUri = data.context.uri;
                    setContext({ type: contextType, uri: contextUri });
                } else {
                    setContext(null);
                }
            }
        } catch (error) {
            console.error('Error fetching current track:', error);
        }
    };

    const handlePlay = async () => {
        try {
            await fetch(`${API_BASE}/play`, { method: 'PUT' });
            setIsPlaying(true);
        } catch (error) {
            console.error('Error playing:', error);
        }
    };

    const handlePause = async () => {
        try {
            await fetch(`${API_BASE}/pause`, { method: 'PUT' });
            setIsPlaying(false);
        } catch (error) {
            console.error('Error pausing:', error);
        }
    };

    const handleNext = async () => {
        try {
            await fetch(`${API_BASE}/next`, { method: 'POST' });
            setTimeout(fetchCurrentTrack, 500);
        } catch (error) {
            console.error('Error skipping:', error);
        }
    };

    const handlePrevious = async () => {
        try {
            await fetch(`${API_BASE}/previous`, { method: 'POST' });
            setTimeout(fetchCurrentTrack, 500);
        } catch (error) {
            console.error('Error going back:', error);
        }
    };

    const handleSeek = async (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const position = Math.floor(duration * percent);

        try {
            await fetch(`${API_BASE}/seek`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position })
            });
            setProgress(position);
        } catch (error) {
            console.error('Error seeking:', error);
        }
    };

    const formatTime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const [authUrl, setAuthUrl] = useState('');

    useEffect(() => {
        if (!isAuthenticated) {
            fetch(`${API_BASE}/auth-url`)
                .then(res => res.json())
                .then(data => setAuthUrl(data.authUrl))
                .catch(err => console.error('Error getting auth URL:', err));
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <div className="spotify-player">
                <div className="spotify-auth-prompt">
                    <div className="spotify-icon">🎵</div>
                    <h2>Connect to Spotify</h2>
                    <p>Visit this URL on your phone or computer:</p>
                    <div className="auth-url-display">
                        {authUrl || 'Loading...'}
                    </div>
                    <p className="auth-hint">Say "Home" to go back</p>
                </div>
            </div>
        );
    }

    return (
        <div className="spotify-player">
            {/* Time and Date at top - using same widget as home page */}
            <div className="spotify-time-section">
                <TimeDateWidget />
            </div>

            {/* Album Art */}
            <div className="album-art-container">
                {currentTrack?.albumArt ? (
                    <img
                        src={currentTrack.albumArt}
                        alt={currentTrack.album}
                        className="album-art"
                    />
                ) : (
                    <div className="album-art-placeholder">🎵</div>
                )}
            </div>

            {/* Track Info */}
            <div className="track-info">
                <h1 className="track-title">
                    {currentTrack?.name || 'No track playing'}
                </h1>
                <p className="track-artist">
                    {currentTrack?.artist || 'Select a song on Spotify'}
                </p>
            </div>

            {/* Device and Context Info */}
            <div className="playback-info">
                {device && (
                    <div className="device-info">
                        <span className="info-icon">🔊</span>
                        <span>{device}</span>
                    </div>
                )}
                {context && context.type !== 'track' && (
                    <div className="context-info">
                        <span className="info-icon">
                            {context.type === 'playlist' ? '📋' : context.type === 'album' ? '💿' : '🎵'}
                        </span>
                        <span>{context.type === 'playlist' ? 'Playlist' : currentTrack?.album}</span>
                    </div>
                )}
            </div>

            {/* Progress Bar with Play/Pause Button */}
            <div className="progress-section">
                <button
                    className="playback-toggle-btn"
                    onClick={isPlaying ? handlePause : handlePlay}
                >
                    {isPlaying ? '⏸' : '▶'}
                </button>
                <span className="time-label">{formatTime(progress)}</span>
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${(progress / duration) * 100}%` }}
                    />
                </div>
                <span className="time-label">{formatTime(duration)}</span>
            </div>
        </div>
    );
}
