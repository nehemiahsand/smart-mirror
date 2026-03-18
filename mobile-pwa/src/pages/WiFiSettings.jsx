import React, { useState, useEffect } from 'react';
import './WiFiSettings.css';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import { apiFetch } from '../api/apiClient';

export default function WiFiSettings() {
  const [networks, setNetworks] = useState([]);
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [alertModal, setAlertModal] = useState(null);

  useEffect(() => {
    loadCurrentNetwork();
    scanNetworks();
  }, []);

  const loadCurrentNetwork = async () => {
    try {
      const response = await apiFetch('/api/wifi/current');
      const data = await response.json();
      if (data.ssid) {
        setCurrentNetwork(data);
      }
    } catch (error) {
      console.error('Failed to load current network:', error);
    }
  };

  const scanNetworks = async () => {
    setScanning(true);
    try {
      const response = await apiFetch('/api/wifi/scan');
      const data = await response.json();
      setNetworks(data.networks || []);
    } catch (error) {
      console.error('Failed to scan networks:', error);
    } finally {
      setScanning(false);
    }
  };

  const connectToNetwork = async () => {
    if (!selectedNetwork || connecting) return;

    setConnecting(true);
    try {
      const response = await apiFetch('/api/wifi/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: selectedNetwork.ssid,
          password: password
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.captivePortal) {
          const portalUrl = data.portalUrl || 'http://captive.apple.com';
          setConfirmModal({
            message: `Connected successfully!\n\nThis network requires captive portal authentication (like campus WiFi).\n\nClick OK to open the login page.`,
            confirmText: 'Open Login',
            onConfirm: () => {
              window.open(portalUrl, '_blank');
              setConfirmModal(null);
            }
          });
        } else if (data.rebooting) {
          setAlertModal({
            type: 'success',
            message: `Connected successfully!\n\nThe smart mirror will reboot in ${data.rebootDelay / 1000} seconds to apply the new network settings.\n\nYou may need to reconnect your phone to the new network.`
          });
        } else {
          setAlertModal({ type: 'success', message: 'Connected successfully!' });
        }

        setSelectedNetwork(null);
        setPassword('');
        setTimeout(() => {
          loadCurrentNetwork();
        }, 3000);
      } else {
        setAlertModal({ type: 'error', message: 'Failed to connect: ' + (data.message || data.error || 'Unknown error') });
      }
    } catch (error) {
      setAlertModal({ type: 'error', message: 'Connection failed: ' + error.message });
    } finally {
      setConnecting(false);
    }
  };

  const getSignalIcon = (signal) => {
    if (signal > -50) return '📶';
    if (signal > -60) return '📶';
    if (signal > -70) return '📡';
    return '📡';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>WiFi</h1>
      </div>

      {/* Current Network */}
      {currentNetwork && (
        <div className="card">
          <div className="card-header">
            <span className="card-icon">✓</span>
            <h2>Connected Network</h2>
          </div>
          <div className="current-network">
            <div className="network-info">
              <div className="network-name">{currentNetwork.ssid}</div>
              <div className="network-details">
                {currentNetwork.ip && <span>IP: {currentNetwork.ip}</span>}
                {currentNetwork.signal && <span>Signal: {currentNetwork.signal} dBm</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Available Networks */}
      <div className="card">
        <div className="card-header">
          <span className="card-icon">📡</span>
          <h2>Available Networks</h2>
          <button
            className="btn-scan"
            onClick={scanNetworks}
            disabled={scanning}
          >
            {scanning ? '⟳' : '🔄'}
          </button>
        </div>

        {scanning ? (
          <div className="scanning">Scanning for networks...</div>
        ) : (
          <div className="networks-list">
            {networks.map((network, index) => (
              <div
                key={index}
                className={`network-item ${selectedNetwork?.ssid === network.ssid ? 'selected' : ''}`}
                onClick={() => setSelectedNetwork(network)}
              >
                <span className="signal-icon">{getSignalIcon(network.signal)}</span>
                <div className="network-details">
                  <div className="network-ssid">{network.ssid}</div>
                  <div className="network-meta">
                    {network.secured && <span>🔒</span>}
                    {!network.secured && <span>🔓 Open</span>}
                    <span>Signal: {network.signal}%</span>
                  </div>
                </div>
                {currentNetwork?.ssid === network.ssid && (
                  <span className="connected-badge">Connected</span>
                )}
              </div>
            ))}
            {networks.length === 0 && (
              <div className="no-data">No networks found</div>
            )}
          </div>
        )}
      </div>

      {/* Connection Form */}
      {selectedNetwork && (
        <div className="card connect-form">
          <div className="card-header">
            <span className="card-icon">🔑</span>
            <h2>Connect to {selectedNetwork.ssid}</h2>
          </div>

          {!selectedNetwork.secured && (
            <div className="info-box">
              <p>ℹ️ This is an open network. If it requires sign-in (like campus WiFi or hotel WiFi), you'll be prompted to authenticate after connecting.</p>
            </div>
          )}

          {selectedNetwork.secured && (
            <div className="form-group">
              <label>Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter WiFi password"
                />
                <button
                  className="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              className="btn-secondary"
              onClick={() => {
                setSelectedNetwork(null);
                setPassword('');
              }}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={connectToNetwork}
              disabled={connecting || (selectedNetwork.security !== 'Open' && !password)}
            >
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          title="Confirm Action"
          message={confirmModal.message}
          confirmText={confirmModal.confirmText || 'Confirm'}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          danger={confirmModal.danger}
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
