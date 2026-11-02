import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DateTime } from 'luxon';
import {
    AlarmClock,
    ArrowUpRight,
    Camera,
    Image,
    LampDesk,
    Moon,
    PanelsTopLeft,
    Settings2,
    SlidersHorizontal,
    Sun,
    Activity
} from 'lucide-react';
import { useNexus } from '../state/NexusProvider';
import { Button, Notice, Surface, Switch } from '../components/NexusUI';
import { CLOCK_ZONE, clockSummary, formatEpoch } from '../utils/clockTime';
import {
    deviceCounts,
    deviceStatus,
    sensorSummary,
    lightingSummary,
    brightnessPercent
} from '../utils/nexusSummary';
import { formatMeasurement } from '../utils/deviceFormatting';

function More({ to, children }) {
    return (
        <Link className="home-more" to={to}>
            {children}
            <ArrowUpRight aria-hidden="true" />
        </Link>
    );
}
function CardHeading({ icon: Icon, title, to, action }) {
    return (
        <div className="home-card-heading">
            <h2>
                <Icon aria-hidden="true" />
                {title}
            </h2>
            <More to={to}>{action}</More>
        </div>
    );
}
function NumberReading({ value, unit }) {
    return (
        <strong>
            {value === null ? '—' : value}
            <small>{unit}</small>
        </strong>
    );
}
export default function Home() {
    const { data, errors, connected, commands, request } = useNexus();
    const [now, setNow] = useState(Date.now());
    const [photoCount, setPhotoCount] = useState();
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        let active = true;
        let controller;
        async function load() {
            controller?.abort();
            const attempt = new AbortController();
            controller = attempt;
            try {
                const result = await request('/api/photos', undefined, {
                    signal: attempt.signal
                });
                if (active && !attempt.signal.aborted)
                    setPhotoCount(
                        Array.isArray(result.photos)
                            ? result.photos.length
                            : undefined
                    );
            } catch (_) {
                if (active && !attempt.signal.aborted) setPhotoCount(undefined);
            }
        }
        const foreground = () => {
            if (!document.hidden) load();
        };
        load();
        window.addEventListener('focus', foreground);
        document.addEventListener('visibilitychange', foreground);
        return () => {
            active = false;
            controller?.abort();
            window.removeEventListener('focus', foreground);
            document.removeEventListener('visibilitychange', foreground);
        };
    }, [request]);
    const counts = deviceCounts(data.devices?.devices);
    const devices = data.devices?.devices || [];
    const deviceOrder = new Map(
        data.config?.devices?.map((device, index) => [device.id, index])
    );
    const orderedDevices = data.config?.devices
        ? [...devices].sort(
              (a, b) =>
                  (deviceOrder.get(a.id) ?? Infinity) -
                  (deviceOrder.get(b.id) ?? Infinity)
          )
        : devices;
    const clock = clockSummary(data.clock);
    const reading = sensorSummary(data, now);
    const lighting = lightingSummary(data.lights?.lights);
    const lights = data.lights?.lights || [];
    const mirror = commands.mirror;
    const lightCommands = commands.lighting;
    const mirrorState = data.console
        ? data.console.standby
            ? 'Standby'
            : 'Awake'
        : 'Unavailable';
    const format = data.config?.preferences?.clockFormat || '12h';
    const nextTime = clock?.nextEpoch
        ? formatEpoch(clock.nextEpoch, format)
        : clock
          ? 'No eligible occurrence'
          : 'Unavailable';
    const localTime = DateTime.fromMillis(now, { zone: CLOCK_ZONE });
    const groupDisabled =
        !connected ||
        !!errors.lights ||
        Object.values(lightCommands.pending).some(Boolean) ||
        !lighting?.available;
    return (
        <>
            <header className="home-heading">
                <div>
                    <span className="eyebrow">Your connected setup</span>
                    <h1>Home</h1>
                    <p>The essentials here. Full control one click away.</p>
                </div>
                <div className="home-time">
                    <time dateTime={localTime.toISO()}>
                        {localTime.toFormat(
                            format === '24h' ? 'HH:mm' : 'h:mm a'
                        )}
                    </time>
                    <span>{localTime.toFormat('cccc / LLL d')}</span>
                </div>
            </header>
            <div className="home-pulse" aria-label="Setup summary">
                <span className={connected ? 'home-positive' : ''}>
                    {counts
                        ? `${counts.online} / ${counts.total} devices online`
                        : errors.devices
                          ? 'Devices unavailable'
                          : 'Loading devices…'}
                    {errors.devices && counts ? ' · Last known' : ''}
                </span>
                <span>
                    Mirror{' '}
                    <b>
                        {mirrorState}
                        {data.console && !mirror.available
                            ? ' · Last known'
                            : ''}
                    </b>
                </span>
                <span>
                    Next alarm{' '}
                    <b>
                        {nextTime}
                        {clock && (clock.stale || errors.clock)
                            ? ' · Last known'
                            : ''}
                    </b>
                </span>
                <span>
                    Lights{' '}
                    <b>
                        {lighting
                            ? `${lighting.on} on${lighting.unknown ? ` · ${lighting.unknown} unavailable` : ''}${errors.lights ? ' · Last known' : ''}`
                            : errors.lights
                              ? 'Unavailable'
                              : 'Loading…'}
                    </b>
                </span>
                {!!counts?.setup && (
                    <More to="/settings/connections">
                        {counts.setup}{' '}
                        {counts.setup === 1 ? 'device needs' : 'devices need'}{' '}
                        setup
                    </More>
                )}
            </div>
            <div className="home-grid">
                <Surface className="home-card home-mirror">
                    <CardHeading
                        icon={PanelsTopLeft}
                        title="Mirror"
                        to="/mirror/controls"
                        action="Open mirror"
                    />
                    {!data.console && !errors.console && (
                        <p className="hint">Loading mirror state…</p>
                    )}
                    <div className="home-mirror-summary">
                        <div>
                            <span className="eyebrow">Display</span>
                            <h3>
                                {mirrorState}
                                <span
                                    className={`home-state-dot ${mirror.available ? 'is-live' : ''}`}
                                    aria-hidden="true"
                                />
                            </h3>
                            <p>
                                {data.console?.pageTitle ||
                                    'Waiting for mirror state'}
                                {data.console && !mirror.available
                                    ? ' · Last known state'
                                    : ''}
                            </p>
                        </div>
                        <div className="home-climate">
                            <div>
                                <span className="eyebrow">Room</span>
                                <NumberReading
                                    value={reading.temperature}
                                    unit={`°${reading.unit}`}
                                />
                            </div>
                            <div>
                                <span className="eyebrow">Humidity</span>
                                <NumberReading
                                    value={reading.humidity}
                                    unit="%"
                                />
                            </div>
                        </div>
                    </div>
                    {(reading.stale || errors.sensor) && (
                        <p className="hint">
                            {reading.temperature !== null ||
                            reading.humidity !== null
                                ? 'Last known sensor reading · Stale'
                                : errors.sensor
                                  ? 'Room sensor unavailable'
                                  : 'Waiting for the room sensor'}
                        </p>
                    )}
                    <div className="remote-grid home-remote">
                        {[1, 2, 3, 4].map((number) => (
                            <Button
                                className="remote-key"
                                key={number}
                                disabled={
                                    !mirror.available ||
                                    mirror.pending ||
                                    !data.console?.softButtons?.[
                                        `button${number}`
                                    ]
                                }
                                onClick={() =>
                                    mirror.run('/api/console/button', {
                                        buttonId: `button${number}`
                                    })
                                }
                            >
                                <span className="key-number">{number}</span>
                                <span>
                                    {data.console?.softButtons?.[
                                        `button${number}`
                                    ] || 'Unavailable'}
                                </span>
                            </Button>
                        ))}
                    </div>
                    <div className="home-mirror-actions">
                        <Button
                            className="primary"
                            disabled={
                                !mirror.available ||
                                mirror.pending ||
                                data.console?.standby === true
                            }
                            onClick={() =>
                                mirror.run('/api/display/standby', {
                                    enabled: true
                                })
                            }
                        >
                            <Moon />
                            Standby
                        </Button>
                        <Button
                            disabled={
                                !mirror.available ||
                                mirror.pending ||
                                data.console?.standby === false
                            }
                            onClick={() =>
                                mirror.run('/api/display/standby', {
                                    enabled: false
                                })
                            }
                        >
                            <Sun />
                            Wake up
                        </Button>
                        <a
                            className="home-more"
                            href={
                                data.config?.devices?.find(
                                    (device) => device.id === 'mirror'
                                )?.remoteUrl ||
                                'https://connect.raspberrypi.com/'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Pi Connect
                            <ArrowUpRight />
                        </a>
                    </div>
                    <div className="home-links">
                        <More to="/mirror/edit">
                            <SlidersHorizontal />
                            Edit
                        </More>
                        <More to="/mirror/camera">
                            <Camera />
                            Camera
                        </More>
                        <More to="/mirror/photos">
                            <Image />
                            Photos
                            {photoCount !== undefined ? ` · ${photoCount}` : ''}
                        </More>
                    </div>
                    <Notice
                        error={mirror.error || errors.console}
                        message={mirror.message}
                    />
                </Surface>
                <Surface className="home-card home-clock">
                    <CardHeading
                        icon={AlarmClock}
                        title="Alarms & timers"
                        to="/alarms/alarms"
                        action="Open clock"
                    />
                    {!clock && (
                        <p className="hint">
                            {errors.clock
                                ? 'Clock unavailable'
                                : 'Waiting for your clock'}
                        </p>
                    )}
                    <span className="eyebrow">Next native occurrence</span>
                    <div
                        className={`home-alarm-time ${clock?.nextEpoch ? 'mono' : 'home-no-alarm'}`}
                    >
                        {nextTime}
                    </div>
                    {clock?.nextEpoch && (
                        <p className="home-alarm-date">
                            {DateTime.fromSeconds(clock.nextEpoch, {
                                zone: CLOCK_ZONE
                            }).toFormat('ccc, LLL d, yyyy')}
                        </p>
                    )}
                    {clock && (
                        <div className="home-facts">
                            <span>
                                Master{' '}
                                <b>{clock.masterEnabled ? 'On' : 'Off'}</b>
                            </span>
                            <span>
                                Scheduled <b>{clock.scheduled}</b>
                            </span>
                            <span>
                                Timers <b>{clock.timers}</b>
                            </span>
                            {clock.suspendedTimers > 0 && (
                                <span>{clock.suspendedTimers} suspended</span>
                            )}
                        </div>
                    )}
                    {(clock?.stale || !!errors.clock) && (
                        <p className="hint">
                            Clock offline or awaiting a fresh snapshot · Last
                            known state
                        </p>
                    )}
                    {clock?.busy && (
                        <p className="hint">Sharp controller busy</p>
                    )}
                    {clock && !clock.masterEnabled && (
                        <p className="hint">
                            Smart alarms and timers suspended · Physical/manual
                            alarms remain separate.
                        </p>
                    )}
                    {clock && !clock.gateEnabled && (
                        <p className="hint">
                            Sharp alarm gate off · Native output disabled
                        </p>
                    )}
                    <div className="home-links">
                        <More to="/alarms/alarms">Scheduled alarms</More>
                        <More to="/alarms/alarms#manual">Manual alarm</More>
                        <More to="/alarms/timers">Timers</More>
                    </div>
                    <Notice error={errors.clock} />
                </Surface>
                <Surface className="home-card home-devices">
                    <CardHeading
                        icon={Activity}
                        title="Devices"
                        to="/monitor/devices"
                        action="Open monitor"
                    />
                    {counts ? (
                        <div className="home-fleet-caption">
                            <span>
                                {counts.online} online / {counts.total}{' '}
                                registered · {counts.offline} offline
                            </span>
                            <More to="/settings/connections">
                                {counts.setup} awaiting setup
                            </More>
                        </div>
                    ) : (
                        <p className="hint">
                            {errors.devices
                                ? 'Device list unavailable'
                                : 'Loading device connections…'}
                        </p>
                    )}
                    {errors.devices && counts && (
                        <p className="hint">
                            Device list could not refresh · Last known readings
                        </p>
                    )}
                    {!!devices.length && (
                        <div className="home-table-wrap">
                            <table className="home-device-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Device</th>
                                        <th scope="col">State</th>
                                        <th scope="col">CPU</th>
                                        <th
                                            scope="col"
                                            className="home-extra-metric"
                                        >
                                            Memory
                                        </th>
                                        <th
                                            scope="col"
                                            className="home-extra-metric"
                                        >
                                            Storage
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderedDevices
                                        .slice(0, 7)
                                        .map((device) => (
                                            <tr key={device.id}>
                                                <th scope="row">
                                                    <Link
                                                        className="home-device-link"
                                                        to={`/monitor/devices/${device.id}`}
                                                    >
                                                        {device.name}
                                                    </Link>
                                                </th>
                                                <td>
                                                    <span
                                                        className={
                                                            device.online &&
                                                            !errors.devices
                                                                ? 'home-positive'
                                                                : ''
                                                        }
                                                    >
                                                        {deviceStatus(device)}
                                                    </span>
                                                    {!device.online &&
                                                        Object.keys(
                                                            device.measurements ||
                                                                {}
                                                        ).length > 0 && (
                                                            <small>
                                                                Last known
                                                            </small>
                                                        )}
                                                </td>
                                                {[
                                                    'cpuPercent',
                                                    'memoryPercent',
                                                    'diskPercent'
                                                ].map((key, index) => (
                                                    <td
                                                        key={key}
                                                        className={`${index ? 'home-extra-metric' : ''} ${!device.online ? 'home-last-known' : ''}`}
                                                    >
                                                        {Number.isFinite(
                                                            device
                                                                .measurements?.[
                                                                key
                                                            ]
                                                        )
                                                            ? formatMeasurement(
                                                                  key,
                                                                  device
                                                                      .measurements[
                                                                      key
                                                                  ]
                                                              )
                                                            : '—'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {counts?.total === 0 && (
                        <p className="hint">No registered devices.</p>
                    )}
                    {!!counts && counts.total > 7 && (
                        <More to="/monitor/devices">
                            View all {counts.total} devices
                        </More>
                    )}
                    <Notice error={errors.devices} />
                </Surface>
                <Surface className="home-card home-lights">
                    <CardHeading
                        icon={LampDesk}
                        title="Desk lighting"
                        to="/lights"
                        action="Open lights"
                    />
                    {!lighting && (
                        <p className="hint">
                            {errors.lights
                                ? 'Lighting unavailable'
                                : 'Loading lighting connections…'}
                        </p>
                    )}
                    {lighting?.total === 0 && (
                        <p className="hint">
                            Configure your WLED boards in Connections.
                        </p>
                    )}
                    {lights.map((light) => {
                        const brightness = brightnessPercent(light);
                        const stale = !light.online || !!errors.lights;
                        return (
                            <div className="home-light" key={light.id}>
                                <div className="row">
                                    <div>
                                        <h3>{light.name}</h3>
                                        <small>
                                            {light.error === 'not_configured'
                                                ? 'Not configured'
                                                : stale
                                                  ? `${light.online ? 'Unavailable' : 'Offline'} · Last known state`
                                                  : typeof light.state?.on ===
                                                      'boolean'
                                                    ? light.state.on
                                                        ? 'On · WLED'
                                                        : 'Off · WLED'
                                                    : 'Power unavailable'}
                                        </small>
                                    </div>
                                    <div className="home-light-power">
                                        <span className="mono">
                                            {brightness === null
                                                ? '—'
                                                : `${brightness}%`}
                                        </span>
                                        <Switch
                                            label={`${light.name} power`}
                                            checked={light.state?.on}
                                            disabled={
                                                !connected ||
                                                stale ||
                                                !!lightCommands.pending[
                                                    light.id
                                                ] ||
                                                !!lightCommands.pending.all
                                            }
                                            onChange={(event) =>
                                                lightCommands.send(light.id, {
                                                    on: event.target.checked
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                                <div
                                    className={`home-light-meter ${stale ? 'home-last-known' : ''}`}
                                    role={
                                        brightness === null
                                            ? undefined
                                            : 'meter'
                                    }
                                    aria-label={`${light.name} brightness`}
                                    aria-valuenow={brightness ?? undefined}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                >
                                    <span
                                        style={{ width: `${brightness ?? 0}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {!!lighting?.total && (
                        <div className="row home-group-power">
                            <div>
                                <h3>All lights</h3>
                                <small>
                                    {lighting.mixed
                                        ? 'Mixed power state'
                                        : lighting.allOn
                                          ? 'All on'
                                          : lighting.on
                                            ? `${lighting.on} on`
                                            : 'None reported on'}
                                    {lighting.unknown
                                        ? ` · ${lighting.unknown} unavailable`
                                        : ''}
                                </small>
                            </div>
                            <Switch
                                label="All lights power"
                                checked={lighting.allOn}
                                disabled={groupDisabled}
                                onChange={(event) =>
                                    lightCommands.send('all', {
                                        on: event.target.checked
                                    })
                                }
                            />
                        </div>
                    )}
                    <p className="hint">
                        Brightness, color, and presets in Lights.
                    </p>
                    <Notice
                        error={lightCommands.error || errors.lights}
                        message={lightCommands.message}
                    />
                </Surface>
            </div>
            <section className="home-settings">
                <Settings2 aria-hidden="true" />
                <div>
                    <h2>Workspace settings</h2>
                    <p>
                        <Link to="/settings#appearance">Appearance</Link>
                        <Link to="/settings/connections">Connections</Link>
                        <Link to="/settings#preferences">Units & time</Link>
                        <Link to="/settings#backup">Backup & restore</Link>
                        <Link to="/settings#access">Access</Link>
                    </p>
                </div>
                <More to="/settings">Open settings</More>
            </section>
        </>
    );
}
