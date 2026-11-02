import {
    lastSeen,
    stateLabel,
    formatMeasurement,
    temperature
} from '../utils/deviceFormatting';
export { lastSeen, formatMeasurement } from '../utils/deviceFormatting';
import React, { useState } from 'react';
import {
    AlarmClock,
    ArrowLeft,
    ArrowUpRight,
    CircuitBoard,
    Cpu,
    LampDesk,
    Laptop,
    Search,
    Server
} from 'lucide-react';
import {
    Badge,
    Paper,
    Progress,
    SegmentedControl,
    TextInput
} from '@mantine/core';
import { m, useReducedMotion } from 'motion/react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useNexus } from '../state/NexusProvider';
import {
    Button,
    Confirmation,
    Disclosure,
    Heading,
    Notice,
    Status,
    Subnav
} from '../components/NexusUI';
import WiFiSettings from './WiFiSettings';
import MonitorActivity from './MonitorActivity';

const icons = {
    pi: Cpu,
    console: CircuitBoard,
    clock: AlarmClock,
    wled: LampDesk,
    computer: Laptop
};
const kinds = {
    pi: 'Mirror host',
    console: 'ESP console',
    clock: 'Smart clock',
    wled: 'WLED',
    computer: 'Computer'
};
const labels = {
    cpuPercent: 'CPU',
    memoryPercent: 'Memory',
    diskPercent: 'Storage',
    temperatureC: 'Temperature',
    temperatureCelsius: 'Room temperature',
    humidity: 'Humidity',
    uptimeSeconds: 'Uptime',
    platform: 'Platform',
    hostname: 'Hostname',
    network: 'Network',
    batteryPercent: 'Battery',
    services: 'Services',
    wifiConnected: 'Wi-Fi',
    mqttConnected: 'MQTT',
    sharpBusy: 'Controller',
    ver: 'Firmware',
    uptime: 'Uptime'
};
export function DeviceMetrics({ measurements = {}, celsius = false }) {
    const metrics = [
        ['cpuPercent', 'CPU'],
        ['memoryPercent', 'Memory'],
        ['diskPercent', 'Storage'],
        ['temperatureC', 'Temperature']
    ].filter(([key]) => Number.isFinite(measurements[key]));
    if (!metrics.length) return null;
    return (
        <div className="device-metric-grid">
            {metrics.map(([key, label]) => (
                <div className="device-metric" key={key}>
                    <div className="row">
                        <span>{label}</span>
                        <strong className="mono">
                            {formatMeasurement(key, measurements[key], celsius)}
                        </strong>
                    </div>
                    {key.endsWith('Percent') && (
                        <Progress
                            value={Math.max(
                                0,
                                Math.min(100, measurements[key])
                            )}
                            color={measurements[key] >= 90 ? 'orange' : 'nexus'}
                            size={5}
                            aria-label={`${label} usage`}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
function DeviceSummary({ device, data, celsius }) {
    const measurements = device.measurements || {};
    if (device.kind === 'clock') {
        const state = data.clock?.state;
        return state ? (
            <div className="device-facts">
                <span>
                    Master <strong>{state.masterEnabled ? 'On' : 'Off'}</strong>
                </span>
                <span>
                    Controller{' '}
                    <strong>{state.sharpBusy ? 'Busy' : 'Ready'}</strong>
                </span>
                <span>
                    Timers <strong>{state.timers?.length ?? '—'}</strong>
                </span>
                <span>
                    Time <strong>{state.timeStatus || 'Unavailable'}</strong>
                </span>
            </div>
        ) : (
            <p className="device-empty">Waiting for a clock snapshot</p>
        );
    }
    if (device.kind === 'console') {
        return (
            <div className="device-facts">
                {Number.isFinite(measurements.temperatureCelsius) && (
                    <span>
                        Room{' '}
                        <strong>
                            {temperature(
                                measurements.temperatureCelsius,
                                celsius
                            )}
                        </strong>
                    </span>
                )}
                {Number.isFinite(measurements.humidity) && (
                    <span>
                        Humidity <strong>{measurements.humidity}%</strong>
                    </span>
                )}
                {data.console?.pageTitle && (
                    <span>
                        Page <strong>{data.console.pageTitle}</strong>
                    </span>
                )}
                {device.online && (
                    <span>
                        Mirror{' '}
                        <strong>
                            {data.console?.standby ? 'Standby' : 'Awake'}
                        </strong>
                    </span>
                )}
                {!Object.keys(measurements).length && !device.online && (
                    <span>Waiting for console telemetry</span>
                )}
            </div>
        );
    }
    if (device.kind === 'wled') {
        const light = data.lights?.lights?.find(
            (item) => item.id === device.id
        );
        const rgb = light?.state?.seg?.[0]?.col?.[0];
        return light?.state ? (
            <>
                <div className="device-facts">
                    <span>
                        Power <strong>{light.state.on ? 'On' : 'Off'}</strong>
                    </span>
                    <span>
                        Brightness{' '}
                        <strong>
                            {Number.isFinite(light.state.bri)
                                ? `${Math.round((light.state.bri / 255) * 100)}%`
                                : 'Unavailable'}
                        </strong>
                    </span>
                    {measurements.ver && (
                        <span>
                            Firmware <strong>{measurements.ver}</strong>
                        </span>
                    )}
                </div>
                <div
                    className="device-light-preview"
                    style={{
                        background: rgb
                            ? `rgb(${rgb.slice(0, 3).join(',')})`
                            : 'var(--soft)',
                        opacity: light.state.on ? 1 : 0.25
                    }}
                />
            </>
        ) : (
            <p className="device-empty">Add the board address in Connections</p>
        );
    }
    if (
        ['cpuPercent', 'memoryPercent', 'diskPercent', 'temperatureC'].some(
            (key) => Number.isFinite(measurements[key])
        )
    )
        return (
            <>
                <DeviceMetrics measurements={measurements} celsius={celsius} />
                <div className="device-facts">
                    {measurements.platform && (
                        <span>{measurements.platform}</span>
                    )}
                    {Number.isFinite(measurements.uptimeSeconds) && (
                        <span>
                            Up{' '}
                            {formatMeasurement(
                                'uptimeSeconds',
                                measurements.uptimeSeconds
                            )}
                        </span>
                    )}
                </div>
            </>
        );
    return (
        <p className="device-empty">
            {device.status === 'not_configured'
                ? 'Waiting for connection setup'
                : device.online
                  ? 'Connected · Open for device details'
                  : 'No current telemetry'}
        </p>
    );
}
export default function Monitor() {
    const { view = 'devices', id } = useParams();
    const location = useLocation();
    const { data, errors, request, refresh } = useNexus();
    const reduced = useReducedMotion();
    const [confirm, setConfirm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const devices = data.devices?.devices || [];
    const device = devices.find((item) => item.id === id);
    const celsius = data.config?.preferences?.temperature === 'celsius';
    const visible = devices.filter(
        (item) =>
            `${item.name} ${kinds[item.kind] || item.kind}`
                .toLowerCase()
                .includes(search.toLowerCase()) &&
            (filter === 'all' ||
                (filter === 'online' ? item.online : !item.online))
    );
    const online = devices.filter((item) => item.online).length;
    const notConfigured = devices.filter(
        (item) => !item.online && item.status === 'not_configured'
    ).length;
    async function action() {
        setBusy(true);
        setError('');
        try {
            await request(`/api/devices/${device.id}/actions`, {
                action: confirm,
                confirm: true
            });
            setConfirm(null);
            setMessage(
                'Device accepted the request. Reboot/shutdown completion requires reconnect verification.'
            );
            await refresh('devices');
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }
    if (!['devices', 'activity'].includes(view))
        return <Navigate to="/monitor/devices" replace />;
    return (
        <>
            <Heading title="Monitor" />
            <Subnav
                base="monitor"
                items={[
                    ['devices', 'Devices'],
                    ['activity', 'Activity']
                ]}
            />
            <div className="content-column monitor-content">
                {id ? (
                    <>
                        <Link className="back-link" to="/monitor/devices">
                            <ArrowLeft /> Devices
                        </Link>
                        {device ? (
                            <>
                                <div className="row section-title">
                                    <div>
                                        <span className="eyebrow">
                                            {kinds[device.kind] || device.kind}
                                        </span>
                                        <h2>{device.name}</h2>
                                    </div>
                                    <Status online={device.online}>
                                        {stateLabel(device)}
                                    </Status>
                                </div>
                                <p className="hint">
                                    {lastSeen(device.lastSeen)}
                                    {!device.online &&
                                    Object.keys(device.measurements || {})
                                        .length > 0
                                        ? ' · Last known readings'
                                        : ''}
                                </p>
                                {location.pathname.endsWith('/network') ? (
                                    <div className="nexus-legacy">
                                        <WiFiSettings />
                                    </div>
                                ) : (
                                    <>
                                        <Paper
                                            className="device-detail-panel"
                                            withBorder
                                            p="lg"
                                            radius="lg"
                                        >
                                            <DeviceMetrics
                                                measurements={
                                                    device.measurements
                                                }
                                                celsius={celsius}
                                            />
                                            <dl className="metrics reported-details">
                                                {Object.entries(
                                                    device.measurements || {}
                                                )
                                                    .filter(
                                                        ([key, value]) =>
                                                            value !== null &&
                                                            value !==
                                                                undefined &&
                                                            !(
                                                                [
                                                                    'cpuPercent',
                                                                    'memoryPercent',
                                                                    'diskPercent',
                                                                    'temperatureC'
                                                                ].includes(
                                                                    key
                                                                ) &&
                                                                Number.isFinite(
                                                                    value
                                                                )
                                                            )
                                                    )
                                                    .map(([key, value]) => (
                                                        <div key={key}>
                                                            <dt>
                                                                {labels[key] ||
                                                                    key.replace(
                                                                        /([A-Z])/g,
                                                                        ' $1'
                                                                    )}
                                                            </dt>
                                                            <dd>
                                                                {formatMeasurement(
                                                                    key,
                                                                    value,
                                                                    celsius
                                                                )}
                                                            </dd>
                                                        </div>
                                                    ))}
                                            </dl>
                                            {!Object.keys(
                                                device.measurements || {}
                                            ).length && (
                                                <p className="hint">
                                                    Measurements appear when
                                                    this device reports them.
                                                </p>
                                            )}
                                        </Paper>
                                        <div className="button-row section-title">
                                            {device.remoteUrl && (
                                                <a
                                                    className="button"
                                                    href={device.remoteUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Remote access{' '}
                                                    <ArrowUpRight />
                                                </a>
                                            )}
                                            {device.kind === 'wled' &&
                                                device.address && (
                                                    <a
                                                        className="button"
                                                        href={device.address}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        Open WLED{' '}
                                                        <ArrowUpRight />
                                                    </a>
                                                )}
                                            {device.kind === 'pi' && (
                                                <>
                                                    <Link
                                                        className="button"
                                                        to={`/monitor/devices/${device.id}/network`}
                                                    >
                                                        Network / Wi-Fi
                                                    </Link>
                                                    <Link
                                                        className="button"
                                                        to="/mirror/camera"
                                                    >
                                                        Mirror camera
                                                    </Link>
                                                </>
                                            )}
                                        </div>
                                        <Disclosure title="Maintenance">
                                            {device.capabilities?.length ? (
                                                <div className="button-row">
                                                    {device.capabilities.map(
                                                        (capability) => (
                                                            <Button
                                                                key={capability}
                                                                disabled={
                                                                    busy ||
                                                                    (!device.online &&
                                                                        device.kind !==
                                                                            'pi')
                                                                }
                                                                onClick={() =>
                                                                    setConfirm(
                                                                        capability
                                                                    )
                                                                }
                                                            >
                                                                {capability.replace(
                                                                    'restart-service:',
                                                                    'Restart service: '
                                                                )}
                                                            </Button>
                                                        )
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="hint">
                                                    No maintenance actions
                                                    available for this device.
                                                </p>
                                            )}
                                        </Disclosure>
                                    </>
                                )}
                            </>
                        ) : (
                            <p>Loading device…</p>
                        )}
                    </>
                ) : view === 'devices' ? (
                    <>
                        <div
                            className="monitor-summary"
                            aria-label="Device overview"
                        >
                            <div>
                                <span className="eyebrow">Connected</span>
                                <strong>
                                    {online}
                                    <small> / {devices.length}</small>
                                </strong>
                            </div>
                            <div>
                                <span className="eyebrow">Offline</span>
                                <strong>
                                    {
                                        devices.filter(
                                            (item) =>
                                                !item.online &&
                                                item.status !== 'not_configured'
                                        ).length
                                    }
                                </strong>
                            </div>
                            <div>
                                <span className="eyebrow">Awaiting setup</span>
                                <strong>{notConfigured}</strong>
                            </div>
                        </div>
                        <div className="device-toolbar">
                            <TextInput
                                aria-label="Search devices"
                                placeholder="Find a device…"
                                leftSection={<Search size={16} />}
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.currentTarget.value)
                                }
                            />
                            <SegmentedControl
                                aria-label="Filter devices"
                                value={filter}
                                onChange={setFilter}
                                data={[
                                    { value: 'all', label: 'All' },
                                    { value: 'online', label: 'Online' },
                                    { value: 'offline', label: 'Offline' }
                                ]}
                            />
                        </div>
                        <div className="device-grid">
                            {visible.map((item) => {
                                const Icon = icons[item.kind] || Server;
                                return (
                                    <m.div
                                        className="device-card-motion"
                                        key={item.id}
                                        initial={
                                            reduced
                                                ? false
                                                : { opacity: 0, y: 8 }
                                        }
                                        animate={{ opacity: 1, y: 0 }}
                                        whileHover={
                                            reduced ? undefined : { y: -3 }
                                        }
                                        transition={{
                                            duration: reduced ? 0 : 0.18
                                        }}
                                    >
                                        <Paper
                                            component={Link}
                                            to={`/monitor/devices/${item.id}`}
                                            className={`device-card ${item.online ? '' : 'device-card-stale'}`}
                                            withBorder
                                            radius="lg"
                                            p="lg"
                                        >
                                            <div className="row">
                                                <span className="device-glyph">
                                                    <Icon />
                                                </span>
                                                <div className="grow">
                                                    <span className="eyebrow">
                                                        {kinds[item.kind] ||
                                                            item.kind}
                                                    </span>
                                                    <h2>{item.name}</h2>
                                                </div>
                                                <Status online={item.online}>
                                                    {stateLabel(item)}
                                                </Status>
                                            </div>
                                            {!item.online &&
                                                Object.keys(
                                                    item.measurements || {}
                                                ).length > 0 && (
                                                    <small className="stale-caption">
                                                        Last known readings
                                                    </small>
                                                )}
                                            <DeviceSummary
                                                device={item}
                                                data={data}
                                                celsius={celsius}
                                            />
                                            {item.error &&
                                                item.error !==
                                                    'not_configured' && (
                                                    <small className="error-text">
                                                        {item.error.replaceAll(
                                                            '_',
                                                            ' '
                                                        )}
                                                    </small>
                                                )}
                                            <div className="device-card-footer">
                                                <small>
                                                    {lastSeen(item.lastSeen)}
                                                </small>
                                                <ArrowUpRight size={15} />
                                            </div>
                                        </Paper>
                                    </m.div>
                                );
                            })}
                        </div>
                        <Link
                            className="back-link section-title"
                            to="/settings/connections"
                        >
                            Manage connections <ArrowUpRight />
                        </Link>
                        {!visible.length && (
                            <p className="hint">
                                {devices.length
                                    ? 'No devices match this filter.'
                                    : 'Loading device connections…'}
                            </p>
                        )}
                    </>
                ) : (
                    <MonitorActivity entries={data.activity?.entries} devices={devices} error={errors.activity} />
                )}
                <Notice error={error || errors.devices} message={message} />
            </div>
            {confirm && (
                <Confirmation
                    title={`${confirm.replace('restart-service:', 'Restart service ')}?`}
                    text={`This sends a maintenance command to ${device.name}.`}
                    busy={busy}
                    error={error}
                    onClose={() => setConfirm(null)}
                    onConfirm={action}
                />
            )}
        </>
    );
}
