import React, { useState, useEffect } from 'react';
import './Settings.css';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';

const API_BASE = `http://${window.location.hostname}:3001`;

export default function Settings() {
  const [systemInfo, setSystemInfo] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState(null);
  const [alertModal, setAlertModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sysInfo, settingsData] = await Promise.all([
        fetch(`${API_BASE}/api/system/info`).then(r => r.json()),
        fetch(`${API_BASE}/api/settings`).then(r => r.json())
      ]);
      setSystemInfo(sysInfo);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(r => r.unregister());
      });
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
      setAlertModal({
        type: 'success',
        message: 'Cache cleared! Reloading app...',
        onClose: () => window.location.reload()
      });
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const confirmResetSettings = () => {
    setConfirmModal({
      message: 'Reset all settings to defaults? This cannot be undone.',
      onConfirm: resetSettings,
      danger: true
    });
  };

  const resetSettings = async () => {
    setConfirmModal(null);

    try {
      await fetch(`${API_BASE}/api/settings/reset`, { method: 'POST' });
      setAlertModal({ type: 'success', message: 'Settings reset to defaults' });
      loadData();
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setAlertModal({ type: 'error', message: 'Failed to reset settings' });
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

  const confirmPowerAction = (action) => {
    const message = action === 'shutdown' ?
      'Shut down the mirror now? You will need to power it back on (e.g., smart plug).' :
      'Reboot the mirror now?';
    setConfirmModal({ action, message, onConfirm: () => callPower(action), danger: action === 'shutdown' });
  };

  const callPower = async (action) => {
    setConfirmModal(null);
    try {
      const res = await fetch(`${API_BASE}/api/power/${action}`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Server returned ${res.status}`);
      setAlertModal({ type: 'success', message: `${action === 'shutdown' ? 'Shutdown' : 'Reboot'} initiated` });
    } catch (e) {
      setAlertModal({ type: 'error', message: `Failed: ${e.message}` });
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <span className="card-icon">⚡</span>
          <h2>Quick Actions</h2>
        </div>
        <div className="actions-list">
          <button className="action-button" onClick={() => window.location.reload()}>
            <span>🔄</span>
            <span>Reload App</span>
          </button>
          <button className="action-button" onClick={clearCache}>
            <span>🗑️</span>
            <span>Clear Cache</span>
          </button>
          <button className="action-button" onClick={() => confirmPowerAction('reboot')}>
            <span>🔁</span>
            <span>Reboot Mirror</span>
          </button>
        </div>
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
                  {systemInfo.uptime ? Math.floor(systemInfo.uptime / 3600) + ' hours' : 'Unknown'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card danger-card">
        <div className="card-header">
          <span className="card-icon">⚠️</span>
          <h2>Danger Zone</h2>
        </div>
        <div className="actions-list">
          <button className="action-button danger" onClick={confirmResetSettings}>
            <span>🔥</span>
            <span>Reset All Settings</span>
          </button>
        </div>
        <p className="danger-note">
          This will reset all mirror settings to factory defaults including widgets, layout, and preferences.
        </p>
      </div>

      {confirmModal && (
        <ConfirmModal
          title="Confirm Action"
          message={confirmModal.message}
          confirmText={confirmModal.action === 'shutdown' ? 'Shutdown' : confirmModal.action === 'reboot' ? 'Reboot' : 'Reset'}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          danger={confirmModal.danger}
        />
      )}

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
