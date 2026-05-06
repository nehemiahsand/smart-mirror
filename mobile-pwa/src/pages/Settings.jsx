import React, { useState, useEffect } from 'react';
import './Settings.css';
import AlertModal from '../components/AlertModal';
import { apiFetch } from '../api/apiClient';

export default function Settings({ authenticated = false, onAuthChange = () => {} }) {
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertModal, setAlertModal] = useState(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState(null);
  const [spotifyBusy, setSpotifyBusy] = useState(false);

  const formatUptime = (seconds) => {
    if (!seconds || Number.isNaN(Number(seconds))) return 'Unknown';
    const totalSeconds = Math.floor(Number(seconds));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes) => {
    if (bytes == null || Number.isNaN(Number(bytes))) return 'Unknown';
    const value = Number(bytes);
    const gb = value / (1024 ** 3);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = value / (1024 ** 2);
    return `${mb.toFixed(0)} MB`;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const sysInfo = await apiFetch('/api/system/info').then(r => r.json());
      setSystemInfo(sysInfo);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
    refreshSpotifyStatus();
  };

  const refreshSpotifyStatus = async () => {
    try {
      const status = await apiFetch('/api/spotify/status').then(r => r.json());
      setSpotifyStatus(status);
    } catch (error) {
      console.error('Failed to load Spotify status:', error);
      setSpotifyStatus({ configured: false, authenticated: false });
    }
  };

  const handleSpotifyDisconnect = async () => {
    if (!authenticated) {
      setAlertModal({ type: 'error', message: 'Log in as admin first' });
      return;
    }
    setSpotifyBusy(true);
    try {
      const res = await apiFetch('/api/spotify/logout', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAlertModal({ type: 'success', message: 'Spotify disconnected' });
      await refreshSpotifyStatus();
    } catch (e) {
      setAlertModal({ type: 'error', message: `Disconnect failed: ${e.message}` });
    } finally {
      setSpotifyBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Settings</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginPassword) return;
    setLoginBusy(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Server returned ${res.status}`);
      }
      onAuthChange(true);
      setLoginPassword('');
      setAlertModal({ type: 'success', message: 'Admin login successful' });
    } catch (e) {
      setAlertModal({ type: 'error', message: `Login failed: ${e.message}` });
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {
      // Clearing local auth state still matters even if the request fails.
    } finally {
      onAuthChange(false);
      window.location.href = '/login';
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      {/* System Info */}
      <div className="card">
        <div className="card-header">
          <span className="card-icon">ℹ️</span>
          <h2>System Info</h2>
        </div>
        <div className="settings-list">
          {systemInfo && (
            <>
              <div className="setting-item">
                <span className="setting-label">Hostname</span>
                <span className="setting-value">{systemInfo.hostname || 'Unknown'}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Uptime</span>
                <span className="setting-value">
                  {formatUptime(systemInfo.uptime)}
                </span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Backend Uptime</span>
                <span className="setting-value">
                  {formatUptime(systemInfo.processUptime)}
                </span>
              </div>
              <div className="setting-item">
                <span className="setting-label">CPU Load (1m)</span>
                <span className="setting-value">
                  {systemInfo.cpuLoad?.normalized1mPercent != null
                    ? `${systemInfo.cpuLoad.normalized1mPercent}%`
                    : 'Unknown'}
                </span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Disk Usage</span>
                <span className="setting-value">
                  {systemInfo.disk
                    ? `${formatBytes(systemInfo.disk.usedBytes)} / ${formatBytes(systemInfo.disk.totalBytes)} (${systemInfo.disk.usedPercent}%)`
                    : 'Unknown'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Admin Login */}
      <div className="card">
        <div className="card-header">
          <span className="card-icon">🔑</span>
          <h2>Admin Access</h2>
        </div>
        {authenticated ? (
          <div className="settings-list">
            <div className="setting-item">
              <span className="setting-label">Status</span>
              <span className="setting-value">Logged in</span>
            </div>
            <div className="actions-list">
              <button className="action-button" onClick={handleLogout}>
                <span>🚪</span>
                <span>Log Out</span>
              </button>
            </div>
          </div>
        ) : (
          <form className="settings-list" onSubmit={handleLogin}>
            <div className="setting-item">
              <span className="setting-label">Admin Password</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter admin password"
              />
            </div>
            <div className="actions-list">
              <button className="action-button" type="submit" disabled={loginBusy || !loginPassword}>
                <span>{loginBusy ? '⏳' : '✅'}</span>
                <span>{loginBusy ? 'Logging in...' : 'Log In as Admin'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Spotify Connection */}
      <div className="card">
        <div className="card-header">
          <span className="card-icon">🎵</span>
          <h2>Spotify Connection</h2>
        </div>
        <div className="settings-list">
          <div className="setting-item">
            <span className="setting-label">Status</span>
            <span className="setting-value">
              {spotifyStatus == null
                ? 'Loading...'
                : !spotifyStatus.configured
                  ? 'Client credentials missing'
                  : spotifyStatus.authenticated
                    ? 'Connected'
                    : 'Not connected'}
            </span>
          </div>
          {spotifyStatus?.authenticated ? (
            <div className="actions-list">
              <button
                className="action-button"
                onClick={handleSpotifyDisconnect}
                disabled={spotifyBusy || !authenticated}
              >
                <span>{spotifyBusy ? '⏳' : '🚪'}</span>
                <span>{spotifyBusy ? 'Disconnecting...' : 'Disconnect Spotify'}</span>
              </button>
              <button className="action-button" onClick={refreshSpotifyStatus}>
                <span>🔄</span>
                <span>Refresh Status</span>
              </button>
            </div>
          ) : (
            <>
              <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span className="setting-label">Connect from your laptop</span>
                <span className="setting-value" style={{ fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {`MIRROR_URL=${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'} ADMIN_PASSWORD=*** node scripts/spotify-auth.mjs`}
                </span>
                <span className="setting-value" style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                  In Spotify dashboard add Redirect URI: <code>http://127.0.0.1:8888/callback</code>
                </span>
              </div>
              <div className="actions-list">
                <button className="action-button" onClick={refreshSpotifyStatus}>
                  <span>🔄</span>
                  <span>Refresh Status</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {alertModal && (
        <AlertModal
          message={alertModal.message}
          type={alertModal.type}
          onClose={alertModal.onClose || (() => setAlertModal(null))}
        />
      )}
    </div>
  );
}
