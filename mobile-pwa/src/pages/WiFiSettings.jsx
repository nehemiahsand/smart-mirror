import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, RefreshCw, Wifi } from 'lucide-react';
import { Button, Notice, Surface } from '../components/NexusUI';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import { apiFetch } from '../api/apiClient';
import './WiFiSettings.css';

async function wifiRequest(path, options) {
    const response = await apiFetch(path, options);
    const data = await response.json();
    if (!response.ok)
        throw new Error(data.error || data.message || 'Wi-Fi request failed');
    return data;
}

export default function WiFiSettings() {
    const [networks, setNetworks] = useState([]);
    const [currentNetwork, setCurrentNetwork] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState(null);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [confirmModal, setConfirmModal] = useState(null);
    const [alertModal, setAlertModal] = useState(null);
    const mounted = useRef(false);
    const scanLock = useRef(false);
    const connectLock = useRef(false);
    const refreshTimer = useRef(null);
    const formHeading = useRef(null);
    const selectionButton = useRef(null);

    useEffect(() => {
        mounted.current = true;
        loadCurrentNetwork();
        scanNetworks();
        return () => {
            mounted.current = false;
            clearTimeout(refreshTimer.current);
        };
    }, []);
    useEffect(() => {
        if (selectedNetwork) formHeading.current?.focus();
    }, [selectedNetwork]);

    async function loadCurrentNetwork() {
        try {
            const data = await wifiRequest('/api/wifi/current');
            if (mounted.current) setCurrentNetwork(data.ssid ? data : null);
        } catch (failure) {
            if (mounted.current) setError(failure.message);
        }
    }
    async function scanNetworks() {
        if (scanLock.current) return;
        scanLock.current = true;
        setScanning(true);
        setError('');
        try {
            const data = await wifiRequest('/api/wifi/scan');
            if (mounted.current) setNetworks(data.networks || []);
        } catch (failure) {
            if (mounted.current) setError(failure.message);
        } finally {
            scanLock.current = false;
            if (mounted.current) setScanning(false);
        }
    }
    function cancelSelection() {
        setSelectedNetwork(null);
        setPassword('');
        setShowPassword(false);
        selectionButton.current?.focus();
    }
    async function connectToNetwork(event) {
        event.preventDefault();
        if (!selectedNetwork || connectLock.current) return;
        connectLock.current = true;
        setConnecting(true);
        try {
            const data = await wifiRequest('/api/wifi/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssid: selectedNetwork.ssid, password })
            });
            if (!mounted.current) return;
            if (!data.success)
                throw new Error(
                    data.message || data.error || 'Could not connect'
                );
            if (data.captivePortal) {
                setConfirmModal({
                    message:
                        'Connected. This network requires sign-in. Open its login page to finish connecting.',
                    onConfirm: () => {
                        window.open(
                            data.portalUrl || 'http://captive.apple.com',
                            '_blank',
                            'noopener,noreferrer'
                        );
                        setConfirmModal(null);
                    }
                });
            } else {
                setAlertModal({
                    type: 'success',
                    message: data.rebooting
                        ? `Connected. The mirror will reboot in ${data.rebootDelay / 1000} seconds. You may need to reconnect your phone to the new network.`
                        : 'Connected successfully!'
                });
            }
            cancelSelection();
            refreshTimer.current = setTimeout(loadCurrentNetwork, 3000);
        } catch (failure) {
            if (mounted.current)
                setAlertModal({ type: 'error', message: failure.message });
        } finally {
            connectLock.current = false;
            if (mounted.current) setConnecting(false);
        }
    }
    return (
        <div className="wifi-settings">
            <h2>Wi-Fi</h2>
            <p className="hint">
                Network settings for the mirror host. Connecting may interrupt
                access to Nexus.
            </p>
            <Notice error={error} />
            {currentNetwork && (
                <Surface>
                    <h3>Connected network</h3>
                    <strong className="wifi-ssid">{currentNetwork.ssid}</strong>
                    <div className="wifi-meta">
                        {currentNetwork.ip && (
                            <span>IP: {currentNetwork.ip}</span>
                        )}
                        {Number.isFinite(currentNetwork.signal) && (
                            <span>Signal: {currentNetwork.signal}%</span>
                        )}
                    </div>
                </Surface>
            )}
            <Surface>
                <div className="row wifi-heading">
                    <h3>Available networks</h3>
                    <Button
                        onClick={scanNetworks}
                        disabled={scanning || connecting}
                        aria-label="Scan Wi-Fi networks"
                    >
                        <RefreshCw aria-hidden="true" />{' '}
                        {scanning ? 'Scanning…' : 'Scan'}
                    </Button>
                </div>
                {scanning ? (
                    <p className="hint" role="status">
                        Scanning for networks…
                    </p>
                ) : (
                    <div className="wifi-networks">
                        {networks.map((network, index) => (
                            <button
                                type="button"
                                key={`${network.ssid}-${index}`}
                                className="wifi-network"
                                aria-pressed={
                                    selectedNetwork?.ssid === network.ssid
                                }
                                disabled={connecting}
                                onClick={(event) => {
                                    selectionButton.current =
                                        event.currentTarget;
                                    setPassword('');
                                    setShowPassword(false);
                                    setSelectedNetwork(network);
                                }}
                            >
                                <Wifi aria-hidden="true" />
                                <span className="wifi-network-details">
                                    <strong className="wifi-ssid">
                                        {network.ssid}
                                    </strong>
                                    <span className="wifi-meta">
                                        <span>
                                            {network.secured ? (
                                                <>
                                                    <LockKeyhole aria-hidden="true" />{' '}
                                                    Secured
                                                </>
                                            ) : (
                                                'Open'
                                            )}
                                        </span>
                                        {Number.isFinite(network.signal) && (
                                            <span>
                                                Signal: {network.signal}%
                                            </span>
                                        )}
                                    </span>
                                </span>
                                {currentNetwork?.ssid === network.ssid && (
                                    <span className="wifi-connected">
                                        Connected
                                    </span>
                                )}
                            </button>
                        ))}
                        {!networks.length && !error && (
                            <p className="hint">
                                No networks found. Scan again to refresh.
                            </p>
                        )}
                    </div>
                )}
            </Surface>
            {selectedNetwork && (
                <Surface>
                    <form onSubmit={connectToNetwork}>
                        <h3
                            ref={formHeading}
                            tabIndex={-1}
                            className="wifi-ssid"
                        >
                            Connect to {selectedNetwork.ssid}
                        </h3>
                        {!selectedNetwork.secured && (
                            <p className="hint">
                                This is an open network. You may need to sign in
                                after connecting.
                            </p>
                        )}
                        {selectedNetwork.secured && (
                            <div className="wifi-password">
                                <label
                                    className="field"
                                    htmlFor="wifi-password"
                                >
                                    Wi-Fi password
                                </label>
                                <div className="wifi-password-row">
                                    <input
                                        id="wifi-password"
                                        type={
                                            showPassword ? 'text' : 'password'
                                        }
                                        autoComplete="off"
                                        value={password}
                                        disabled={connecting}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                    />
                                    <Button
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        aria-label={
                                            showPassword
                                                ? 'Hide Wi-Fi password'
                                                : 'Show Wi-Fi password'
                                        }
                                        aria-pressed={showPassword}
                                    >
                                        {showPassword ? <EyeOff /> : <Eye />}
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className="button-row">
                            <Button
                                onClick={cancelSelection}
                                disabled={connecting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="primary"
                                disabled={
                                    connecting ||
                                    (selectedNetwork.secured && !password)
                                }
                            >
                                {connecting ? 'Connecting…' : 'Connect'}
                            </Button>
                        </div>
                    </form>
                </Surface>
            )}
            {confirmModal && (
                <ConfirmModal
                    title="Network sign-in"
                    message={confirmModal.message}
                    confirmText="Open Login"
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}
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
