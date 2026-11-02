import { useNexusAppearance } from '../components/NexusTheme';
import { Button } from '../components/NexusUI';
import React, { useEffect, useState } from 'react';
import { Download, Moon, Sun, Monitor, Upload } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useNexus } from '../state/NexusProvider';
import {
    Confirmation,
    Disclosure,
    Heading,
    Modal,
    Notice
} from '../components/NexusUI';

export default function NexusSettings({ onLogout }) {
    const location = useLocation();
    const { data, errors, request, refresh } = useNexus();
    const [draft, setDraft] = useState(null);
    const [dirty, setDirty] = useState(false);
    const { appearance: theme, setAppearance } = useNexusAppearance();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [backup, setBackup] = useState(null);
    const [preview, setPreview] = useState(null);
    const [spotify, setSpotify] = useState(null);
    const [adding, setAdding] = useState(false);
    useEffect(() => {
        if (data.config && !dirty) setDraft(structuredClone(data.config));
    }, [data.config, dirty]);
    useEffect(() => {
        request('/api/spotify/status')
            .then(setSpotify)
            .catch(() => {});
    }, [request]);
    useEffect(() => {
        const id =
            location.hash.slice(1) ||
            (location.pathname.endsWith('/connections') ? 'connections' : '');
        if (
            ![
                'appearance',
                'connections',
                'preferences',
                'backup',
                'access'
            ].includes(id)
        )
            return;
        const target = document.getElementById(id);
        target?.scrollIntoView({ block: 'start' });
        (target?.querySelector('summary') || target)?.focus({
            preventScroll: true
        });
    }, [location.hash, location.pathname, !!draft]);
    function edit(fn) {
        setDraft(fn);
        setDirty(true);
    }
    function appearance(value) {
        setAppearance(value);
    }
    async function save() {
        setBusy(true);
        setError('');
        try {
            await request('/api/nexus/config', draft);
            await request('/api/nexus/preferences', {
                'weather.units':
                    draft.preferences.temperature === 'celsius'
                        ? 'metric'
                        : 'imperial',
                'display.clockFormat': draft.preferences.clockFormat
            });
            setDirty(false);
            setMessage('Configuration saved.');
            await refresh('config');
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }
    async function exportConfig() {
        try {
            const result = await request('/api/config/export');
            const blob = new Blob([JSON.stringify(result, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `nexus-backup-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
            setError(e.message);
        }
    }
    async function importFile(file) {
        try {
            if (!file || file.size > 262144)
                throw new Error('Choose a JSON backup smaller than 256 KB.');
            const document = JSON.parse(await file.text());
            const result = await request('/api/config/import', { document });
            setBackup(document);
            setPreview(result.preview);
        } catch (e) {
            setError(e.message);
        }
    }
    async function restore() {
        setBusy(true);
        try {
            await request('/api/config/import', {
                document: backup,
                confirm: true
            });
            setBackup(null);
            setPreview(null);
            setDirty(false);
            await refresh();
            setMessage('Configuration restored.');
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }
    async function spotifyAction(disconnect = false) {
        setError('');
        setBusy(true);
        try {
            if (disconnect) {
                await request('/api/spotify/logout', {});
                setSpotify(await request('/api/spotify/status'));
            } else {
                const result = await request('/api/spotify/auth-url');
                window.location.assign(result.authUrl);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <Heading title="Settings">Your command center, configured.</Heading>
            <div className="content-column settings-content">
                <h2 id="appearance" tabIndex={-1}>
                    Appearance
                </h2>
                <p>A technical feel. A quieter finish.</p>
                <div className="preset-row">
                    {[
                        ['light', 'Light', Sun],
                        ['dark', 'Dark', Moon],
                        ['system', 'Follow system', Monitor]
                    ].map(([value, label, Icon]) => (
                        <Button
                            key={value}
                            className={
                                theme === value ? 'selected-control' : ''
                            }
                            aria-pressed={theme === value}
                            onClick={() => appearance(value)}
                        >
                            <Icon />
                            {label}
                        </Button>
                    ))}
                </div>
                <Disclosure
                    title="Connections"
                    id="connections"
                    open={
                        location.pathname.endsWith('/connections') ||
                        location.hash === '#connections'
                    }
                >
                    <Button
                        disabled={!draft || draft.devices.length >= 32}
                        onClick={() => setAdding(true)}
                    >
                        Add device
                    </Button>
                    {draft?.devices.map((device, index) => (
                        <fieldset className="connection-editor" key={device.id}>
                            <legend>{device.name}</legend>
                            <label className="field">
                                Device name
                                <input
                                    value={device.name}
                                    maxLength="120"
                                    onChange={(e) =>
                                        edit((d) => ({
                                            ...d,
                                            devices: d.devices.map((v, i) =>
                                                i === index
                                                    ? {
                                                          ...v,
                                                          name: e.target.value
                                                      }
                                                    : v
                                            )
                                        }))
                                    }
                                />
                            </label>
                            {device.kind === 'wled' && (
                                <label className="field">
                                    WLED origin (LAN address)
                                    <input
                                        type="url"
                                        placeholder="http://192.168.1.50"
                                        value={device.address || ''}
                                        onChange={(e) =>
                                            edit((d) => ({
                                                ...d,
                                                devices: d.devices.map(
                                                    (v, i) =>
                                                        i === index
                                                            ? {
                                                                  ...v,
                                                                  address:
                                                                      e.target
                                                                          .value
                                                              }
                                                            : v
                                                )
                                            }))
                                        }
                                    />
                                </label>
                            )}
                            <label className="field">
                                Remote-access link
                                <input
                                    type="url"
                                    placeholder={
                                        device.kind === 'pi'
                                            ? 'https://connect.raspberrypi.com/'
                                            : 'https://…'
                                    }
                                    value={device.remoteUrl || ''}
                                    onChange={(e) =>
                                        edit((d) => ({
                                            ...d,
                                            devices: d.devices.map((v, i) =>
                                                i === index
                                                    ? {
                                                          ...v,
                                                          remoteUrl:
                                                              e.target.value
                                                      }
                                                    : v
                                            )
                                        }))
                                    }
                                />
                            </label>
                            {['pi', 'computer', 'clock', 'console'].includes(
                                device.kind
                            ) && (
                                <p className="hint">
                                    Device ID: {device.id}. Provision MQTT
                                    credentials on the device using the
                                    deployment runbook. Credentials are never
                                    stored in the browser.
                                </p>
                            )}
                        </fieldset>
                    ))}
                    <h3>Spotify</h3>
                    <p className="hint">
                        {spotify?.authenticated ? 'Connected' : 'Not connected'}
                        . Playback stays on the mirror remote.
                    </p>
                    <Button
                        disabled={busy}
                        onClick={() => spotifyAction(spotify?.authenticated)}
                    >
                        {spotify?.authenticated
                            ? 'Disconnect Spotify'
                            : 'Connect Spotify'}
                    </Button>
                </Disclosure>
                <Disclosure
                    id="preferences"
                    title="Shared preferences"
                    open={location.hash === '#preferences'}
                >
                    {draft && (
                        <>
                            <label className="field">
                                Temperature
                                <select
                                    value={draft.preferences.temperature}
                                    onChange={(e) =>
                                        edit((d) => ({
                                            ...d,
                                            preferences: {
                                                ...d.preferences,
                                                temperature: e.target.value
                                            }
                                        }))
                                    }
                                >
                                    <option value="fahrenheit">
                                        Fahrenheit
                                    </option>
                                    <option value="celsius">Celsius</option>
                                </select>
                            </label>
                            <label className="field">
                                Time format
                                <select
                                    value={draft.preferences.clockFormat}
                                    onChange={(e) =>
                                        edit((d) => ({
                                            ...d,
                                            preferences: {
                                                ...d.preferences,
                                                clockFormat: e.target.value
                                            }
                                        }))
                                    }
                                >
                                    <option value="12h">12-hour</option>
                                    <option value="24h">24-hour</option>
                                </select>
                            </label>
                        </>
                    )}
                    <p className="hint">
                        Defaults shared with your mirror. The smart clock uses
                        America/Chicago.
                    </p>
                </Disclosure>
                {dirty && (
                    <Button
                        className="primary full section-title"
                        onClick={save}
                        disabled={busy}
                    >
                        {busy ? 'Saving…' : 'Save configuration'}
                    </Button>
                )}
                <Disclosure
                    id="backup"
                    title="Backup & restore"
                    open={location.hash === '#backup'}
                >
                    <p className="hint">
                        Exports layouts, connections, and preferences. Secrets,
                        photos, runtime telemetry, and clock schedules are
                        excluded.
                    </p>
                    <div className="button-row">
                        <Button onClick={exportConfig}>
                            <Download /> Export
                        </Button>
                        <label className="button">
                            <Upload /> Import
                            <input
                                type="file"
                                accept="application/json,.json"
                                hidden
                                onChange={(e) => {
                                    importFile(e.target.files[0]);
                                    e.target.value = '';
                                }}
                            />
                        </label>
                    </div>
                </Disclosure>
                <Disclosure
                    id="access"
                    title="Access & about"
                    open={location.hash === '#access'}
                >
                    <div className="row">
                        <strong>Nexus</strong>
                        <span className="tag">1.0</span>
                    </div>
                    <p className="hint">
                        Single-user access. Updates follow your Pi deployment
                        configuration.
                    </p>
                    <Button
                        onClick={async () => {
                            try {
                                await request('/api/auth/logout', {});
                                onLogout();
                            } catch (e) {
                                setError(e.message);
                            }
                        }}
                    >
                        Sign out
                    </Button>
                </Disclosure>
                <p className="hint settings-location-hint">
                    Mirror content lives in{' '}
                    <Link to="/mirror/edit">Mirror → Edit</Link>. Pi Wi-Fi
                    settings live in{' '}
                    <Link to="/monitor/devices/mirror/network">
                        Monitor → Network
                    </Link>
                    .
                </p>
                <Notice error={error || errors.config} message={message} />
            </div>
            {adding && (
                <Modal title="Register device" onClose={() => setAdding(false)}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const fields = new FormData(e.currentTarget);
                            const id = String(fields.get('id'));
                            if (
                                draft.devices.some((device) => device.id === id)
                            ) {
                                setError(
                                    'A device with that ID is already registered.'
                                );
                                return;
                            }
                            const kind = String(fields.get('kind'));
                            edit((previous) => ({
                                ...previous,
                                devices: [
                                    ...previous.devices,
                                    {
                                        id,
                                        name: String(fields.get('name')),
                                        kind
                                    }
                                ]
                            }));
                            setAdding(false);
                        }}
                    >
                        <label className="field">
                            Name
                            <input name="name" required maxLength="120" />
                        </label>
                        <label className="field">
                            Stable device ID
                            <input
                                name="id"
                                required
                                maxLength="64"
                                pattern="[a-z0-9._-]+"
                            />
                        </label>
                        <label className="field">
                            Device type
                            <select name="kind">
                                <option value="computer">Computer agent</option>
                                <option value="console">ESP console</option>
                            </select>
                        </label>
                        <p className="hint">
                            Save configuration, then provision the corresponding
                            device connection. Agent credentials stay on the
                            device.
                        </p>
                        <Notice error={error} />
                        <Button type="submit" className="primary">
                            Register
                        </Button>
                    </form>
                </Modal>
            )}
            {preview && (
                <Confirmation
                    title="Restore configuration?"
                    text={`This restores ${preview.devices.length} device registrations and ${preview.settings.length} settings. Existing secrets remain on the server. No device commands will run.`}
                    onConfirm={restore}
                    onClose={() => {
                        setPreview(null);
                        setBackup(null);
                    }}
                    busy={busy}
                    confirmText="Restore"
                />
            )}
        </>
    );
}
