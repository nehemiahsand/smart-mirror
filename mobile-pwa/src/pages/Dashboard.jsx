import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';

const API_BASE = `http://${window.location.hostname}:3001`;

export default function Dashboard() {
  const [sensorData, setSensorData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [settings, setSettings] = useState(null);
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
      const [sensor, weather, settingsData] = await Promise.all([
        fetch(`${API_BASE}/api/sensor`).then(r => r.json()),
        fetch(`${API_BASE}/api/weather`).then(r => r.json()),
        fetch(`${API_BASE}/api/settings`).then(r => r.json())
      ]);
      setSensorData(sensor);
      setWeatherData(weather);
      setSettings(settingsData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
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
      const res = await fetch(`${API_BASE}/api/power/${action}`, {
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
      const res = await fetch(`${API_BASE}/api/display/refresh`, {
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
      const res = await fetch(`${API_BASE}/api/settings`, {
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
        {/* Indoor Climate */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">🌡️</span>
            <h2>Indoor Climate</h2>
          </div>
          {sensorData && !sensorData.error ? (
            <div className="climate-data">
              <div className="climate-item">
                <div className="value">{sensorData.temperatureFahrenheit}°F</div>
                <div className="label">{sensorData.temperatureCelsius}°C</div>
              </div>
              <div className="climate-item">
                <div className="value">{sensorData.humidity}%</div>
                <div className="label">Humidity</div>
              </div>
            </div>
          ) : (
            <div className="no-data">Sensor unavailable</div>
          )}
        </div>

        {/* Weather */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">☁️</span>
            <h2>Weather</h2>
          </div>
          {weatherData && !weatherData.error ? (
            <div className="weather-data">
              <div className="weather-main">
                <div className="temp">{weatherData.temperature}°</div>
                <div className="desc">{weatherData.description}</div>
              </div>
              <div className="weather-details">
                <div className="detail">
                  <span>Feels like</span>
                  <strong>{weatherData.feelsLike}°</strong>
                </div>
                <div className="detail">
                  <span>Humidity</span>
                  <strong>{weatherData.humidity}%</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-data">Weather unavailable</div>
          )}
        </div>

        {/* Quick Actions */}
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
