import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import { apiFetch } from '../apiClient';

export default function Dashboard() {
  const [sensorData, setSensorData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [trafficData, setTrafficData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [privacy, setPrivacy] = useState({ cameraEnabled: true, voiceEnabled: true });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [alertModal, setAlertModal] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [sensor, weather, traffic, settingsData, privacyStatus] = await Promise.all([
        apiFetch('/api/sensor').then(r => r.json()),
        apiFetch('/api/weather').then(r => r.json()),
        apiFetch('/api/traffic/commute').then(r => r.json()).catch(() => null),
        apiFetch('/api/settings').then(r => r.json()),
        apiFetch('/api/privacy/status').then(r => r.json())
      ]);
      setSensorData(sensor);
      setWeatherData(weather);
      setTrafficData(traffic);
      setSettings(settingsData);
      setPrivacy({
        cameraEnabled: privacyStatus.cameraEnabled !== false,
        voiceEnabled: privacyStatus.voiceEnabled !== false
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  const updatePrivacy = async (changes) => {
    const newPrivacy = { ...privacy, ...changes };
    setPrivacy(newPrivacy);
    try {
      const res = await apiFetch('/api/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraEnabled: newPrivacy.cameraEnabled,
          voiceEnabled: newPrivacy.voiceEnabled
        })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Server returned ${res.status}`);
      }
    } catch (error) {
      setAlertModal({ type: 'error', message: `Failed to update privacy: ${error.message}` });
      fetchData();
    }
  };

  const confirmPowerAction = (action) => {
    const message = action === 'shutdown' ?
      'Shut down the mirror now? You will need to power it back on (e.g., smart plug).' :
      'Reboot the mirror now?';
    setConfirmModal({ action, message });
  };

  const callPower = async (action) => {
    setConfirmModal(null);
    setBusy(true);
    try {
      console.log('Power request:', action);
      const res = await apiFetch(`/api/power/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('Response status:', res.status);
      const json = await res.json();
      console.log('Response body:', json);
      if (!res.ok) {
        throw new Error(json.error || `Server returned ${res.status}`);
      }
      if (!json.success) {
        throw new Error(json.error || 'Request failed');
      }
      setAlertModal({ type: 'success', message: `${action === 'shutdown' ? 'Shutdown' : 'Reboot'} requested successfully!` });
    } catch (e) {
      console.error('Power action failed:', e);
      setAlertModal({ type: 'error', message: `Failed to ${action}: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const refreshDisplay = async () => {
    setBusy(true);
    try {
      const res = await apiFetch('/api/display/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Server returned ${res.status}`);
      }
    } catch (e) {
      console.error('Refresh failed:', e);
      setAlertModal({ type: 'error', message: `Failed to refresh: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const toggleStandbyMode = async () => {
    setBusy(true);
    try {
      const newStandbyMode = !settings?.display?.standbyMode;
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'display.standbyMode': newStandbyMode
        })
      });

      if (!res.ok) {
        throw new Error('Failed to toggle standby mode');
      }

      // Update local state
      setSettings(prev => ({
        ...prev,
        display: {
          ...prev.display,
          standbyMode: newStandbyMode
        }
      }));
    } catch (e) {
      console.error('Standby toggle failed:', e);
      setAlertModal({ type: 'error', message: `Failed to toggle standby: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const changePage = async (page) => {
    setBusy(true);
    try {
      const res = await apiFetch('/api/display/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: page
        })
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to change page');
      }
      setAlertModal({ type: 'success', message: `Display switched to ${page === 'spotify' ? 'Spotify' : 'Home'} page` });
    } catch (e) {
      console.error('Page change failed:', e);
      setAlertModal({ type: 'error', message: `Failed to change page: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="cards">
        {/* Quick Info */}
        <div className="card quick-info-card">
          <div className="card-header">
            <span className="card-icon">📊</span>
            <h2>Quick Info</h2>
          </div>
          <div className="quick-info-grid">
            {/* Indoor Temp */}
            {sensorData && !sensorData.error ? (
              <div className="info-item">
                <div className="info-icon">🏠</div>
                <div className="info-content">
                  <div className="info-value">{sensorData.temperatureFahrenheit}°F</div>
                  <div className="info-label">Indoor Temp</div>
                </div>
              </div>
            ) : null}

            {/* Indoor Humidity */}
            {sensorData && !sensorData.error ? (
              <div className="info-item">
                <div className="info-icon">💧</div>
                <div className="info-content">
                  <div className="info-value">{sensorData.humidity}%</div>
                  <div className="info-label">Indoor Humidity</div>
                </div>
              </div>
            ) : null}

            {/* Outdoor Temp */}
            {weatherData && !weatherData.error ? (
              <div className="info-item">
                <div className="info-icon">🌤️</div>
                <div className="info-content">
                  <div className="info-value">{weatherData.temperature}°</div>
                  <div className="info-label">Outdoor Temp</div>
                </div>
              </div>
            ) : null}

            {/* Traffic */}
            {trafficData && !trafficData.error ? (
              <div className="info-item">
                <div className="info-icon">🚗</div>
                <div className="info-content">
                  <div className="info-value">{trafficData.durationMinutes} min</div>
                  <div className="info-label">To School</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Display Pages */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">📱</span>
            <h2>Display Pages</h2>
          </div>
          <div className="quick-actions">
            <button className="action-btn" disabled={busy} onClick={() => changePage('home')}>
              <span>🏠</span>
              Home Page
            </button>
            <button className="action-btn" disabled={busy} onClick={() => changePage('spotify')}>
              <span>🎵</span>
              Spotify Page
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">🔒</span>
            <h2>Privacy & Input</h2>
          </div>
          <div className="quick-actions">
            <button
              className={`action-btn ${privacy.cameraEnabled ? '' : 'danger'}`}
              disabled={busy}
              onClick={() => updatePrivacy({ cameraEnabled: !privacy.cameraEnabled })}
            >
              <span>{privacy.cameraEnabled ? '📷' : '🚫'}</span>
              {privacy.cameraEnabled ? 'Disable Camera Input' : 'Enable Camera Input'}
            </button>
            <button
              className={`action-btn ${privacy.voiceEnabled ? '' : 'danger'}`}
              disabled={busy}
              onClick={() => updatePrivacy({ voiceEnabled: !privacy.voiceEnabled })}
            >
              <span>{privacy.voiceEnabled ? '🎤' : '🚫'}</span>
              {privacy.voiceEnabled ? 'Disable Voice Input' : 'Enable Voice Input'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-icon">⚡</span>
            <h2>Quick Actions</h2>
          </div>
          <div className="quick-actions">
            <button
              className={`action-btn ${settings?.display?.standbyMode ? 'standby-active' : ''}`}
              disabled={busy}
              onClick={toggleStandbyMode}
            >
              <span>{settings?.display?.standbyMode ? '🌙' : '☀️'}</span>
              {settings?.display?.standbyMode ? 'Wake Mirror' : 'Standby Mode'}
            </button>
            <button className="action-btn" disabled={busy} onClick={refreshDisplay}>
              <span>🔄</span>
              Refresh Display
            </button>
            <button className="action-btn" disabled={busy} onClick={() => confirmPowerAction('reboot')}>
              <span>🔁</span>
              Reboot Mirror
            </button>
            <button className="action-btn danger" disabled={busy} onClick={() => confirmPowerAction('shutdown')}>
              <span>⏻</span>
              Shutdown Mirror
            </button>
          </div>
        </div>
      </div>

      {confirmModal && (
        <ConfirmModal
          title="Confirm Action"
          message={confirmModal.message}
          confirmText={confirmModal.action === 'shutdown' ? 'Shutdown' : 'Reboot'}
          onConfirm={() => callPower(confirmModal.action)}
          onCancel={() => setConfirmModal(null)}
          danger={confirmModal.action === 'shutdown'}
        />
      )}

      {/* Alert Modal */}
      {alertModal && (
        <AlertModal
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal(null)}
        />
      )}
    </div>
  );
}
