import { sensorSummary } from '../utils/nexusSummary';
import { Button } from '../components/NexusUI';
import React, { useState } from 'react';
import { ArrowUpRight, Hand, Moon, PanelsTopLeft, Sun } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import { useNexus } from '../state/NexusProvider';
import {
    Confirmation,
    Disclosure,
    Heading,
    Notice,
    Status,
    Surface,
    Subnav
} from '../components/NexusUI';
import Camera from './Camera';
import Photos from './Photos';
import MirrorEdit from './MirrorEdit';
function Controls() {
    const { data, errors, connected, commands } = useNexus();
    const { pending, error, message, available, run } = commands.mirror;
    const [confirm, setConfirm] = useState(null);
    const consoleState = data.console;
    const sensor = data.sensor;
    const reading = sensorSummary(data);
    const temperature = reading.temperature;
    const celsius = reading.unit === 'C';
    const stale = reading.stale || !connected || !!errors.sensor;
    async function action(path, body) {
        if (await run(path, body)) setConfirm(null);
    }
    return (
        <div className="mirror-dashboard refined-mirror">
            <div className="mirror-summary-strip">
                <div><span className="eyebrow">Display</span><strong>{consoleState ? consoleState.standby ? 'Standby' : 'Awake' : 'Unavailable'}</strong><Status online={available}>{available ? 'Connected' : 'Unavailable'}</Status></div>
                <div><span className="eyebrow">Current page</span><strong>{consoleState?.pageTitle || '—'}</strong><small>ESP labels follow this page</small></div>
                <div><span className="eyebrow">Room temperature</span><strong>{Number.isFinite(temperature) ? `${temperature} °${celsius ? 'C' : 'F'}` : '—'}</strong><small>{!Number.isFinite(temperature) ? 'Reading unavailable' : stale ? 'Last known · Stale' : 'Fresh room reading'}</small></div>
                <div><span className="eyebrow">Humidity</span><strong>{Number.isFinite(sensor?.humidity) ? `${sensor.humidity}%` : '—'}</strong><small>{!Number.isFinite(sensor?.humidity) ? 'Reading unavailable' : stale ? 'Last known · Stale' : 'ESP console sensor'}</small></div>
            </div>
            <Surface className="mirror-controls">
                <div className="row section-title"><div><h2>Mirror remote</h2><small>Same four actions as your ESP console</small></div><span className="tag">ESP · 1–4</span></div>
                <div className="remote-grid">
                    {[1, 2, 3, 4].map((number) => <Button key={number} className="remote-key"
                        disabled={!available || pending || !consoleState?.softButtons?.[`button${number}`]}
                        onClick={() => action('/api/console/button', { buttonId: `button${number}` })}>
                        <span className="key-number">{number}</span><span>{consoleState?.softButtons?.[`button${number}`] || 'Unavailable'}</span>
                    </Button>)}
                </div>
                <p className="hint"><Hand /> Labels follow the active mirror page. Blank ESP actions stay unavailable.</p>
            </Surface>
            <Surface className="mirror-access">
                <div className="row section-title"><div><h2>Display & access</h2><small>Screen power and direct remote access</small></div><PanelsTopLeft /></div>
                <div className="mirror-state-preview"><PanelsTopLeft /><strong>{consoleState?.pageTitle || 'Mirror'}</strong><small>{consoleState ? consoleState.standby ? 'Display in standby' : 'Display awake' : 'Waiting for mirror state'}</small></div>
                <div className="wake-actions">
                    <Button disabled={!available || pending || consoleState?.standby} onClick={() => action('/api/display/standby', { enabled: true })}><Moon /> Standby</Button>
                    <Button className="primary" disabled={!available || pending || !consoleState?.standby} onClick={() => action('/api/display/standby', { enabled: false })}><Sun /> Wake</Button>
                </div>
                <a className="link-row" href={data.config?.devices.find((d) => d.id === 'mirror')?.remoteUrl || 'https://connect.raspberrypi.com/'} target="_blank" rel="noopener noreferrer"><span className="grow"><strong>Pi Connect</strong><small>Direct remote access to your mirror</small></span><ArrowUpRight /></a>
                <Disclosure title="Maintenance"><div className="button-row">
                    <Button disabled={pending || !available} onClick={() => action('/api/display/refresh', {})}>Refresh display</Button>
                    <Button disabled={pending || !available} onClick={() => setConfirm('reboot')}>Reboot</Button>
                    <Button className="danger" disabled={pending || !available} onClick={() => setConfirm('shutdown')}>Shut down</Button>
                </div></Disclosure>
            </Surface>
            <div className="dashboard-feedback"><Notice error={error || errors.console} message={message} /></div>
            {confirm && (
                <Confirmation
                    title={
                        confirm === 'reboot'
                            ? 'Reboot mirror?'
                            : 'Shut down mirror?'
                    }
                    text={
                        confirm === 'shutdown'
                            ? 'The mirror will remain offline until powered on again.'
                            : 'The mirror will disconnect while restarting.'
                    }
                    onClose={() => setConfirm(null)}
                    busy={pending}
                    onConfirm={() => action(`/api/power/${confirm}`, {})}
                />
            )}
        </div>
    );
}
export default function Mirror() {
    const { view } = useParams();
    if (!['controls', 'edit', 'camera', 'photos'].includes(view))
        return <Navigate to="/mirror/controls" replace />;
    return (
        <>
            <Heading title="Mirror">Your mirror. Your controls.</Heading>
            <Subnav
                base="mirror"
                items={['controls', 'edit', 'camera', 'photos'].map((key) => [
                    key,
                    key[0].toUpperCase() + key.slice(1)
                ])}
            />
            <div
                className={`content-column mirror-content mirror-content-${view}`}
            >
                {view === 'controls' ? (
                    <Controls />
                ) : view === 'edit' ? (
                    <MirrorEdit />
                ) : view === 'camera' ? (
                    <Camera />
                ) : (
                    <div className="nexus-legacy">
                        <Photos />
                    </div>
                )}
            </div>
        </>
    );
}
