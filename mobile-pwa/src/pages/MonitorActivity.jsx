import React, { useMemo, useState } from 'react';
import { AlertTriangle, CircleCheck, CircleX, Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Notice } from '../components/NexusUI';
const types = {
    info: { label: 'Event', icon: CircleCheck },
    warn: { label: 'Warning', icon: AlertTriangle },
    warning: { label: 'Warning', icon: AlertTriangle },
    error: { label: 'Error', icon: CircleX }
};
export default function MonitorActivity({ entries, devices, error }) {
    const [device, setDevice] = useState('all');
    const [type, setType] = useState('all');
    const [search, setSearch] = useState('');
    const names = new Map(devices.map((item) => [item.id, item.name]));
    const groups = useMemo(() => {
        const result = new Map();
        for (const entry of entries || []) {
            const severity = types[entry.level]?.label || 'Event';
            const name = names.get(entry.deviceId) || entry.deviceId || 'System';
            if ((device !== 'all' && entry.deviceId !== device) || (type !== 'all' && severity !== type) || !`${name} ${entry.message}`.toLowerCase().includes(search.toLowerCase())) continue;
            const day = new Date(entry.timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            if (!result.has(day)) result.set(day, []);
            result.get(day).push(entry);
        }
        return [...result];
    }, [entries, devices, device, type, search]);
    const ids = [...new Set([...devices.map((d) => d.id), ...(entries || []).map((e) => e.deviceId)])];
    return <section className="monitor-activity">
        <div className="row section-title"><div><h2>Activity</h2><small>Which device, what happened, and whether it needs attention.</small></div><span className="tag">{entries?.length || 0} entries</span></div>
        <div className="activity-filters">
            <label className="field">Search activity<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Device or message…" /></label>
            <label className="field">Device<select value={device} onChange={(e) => setDevice(e.target.value)}><option value="all">All devices</option>{ids.map((id) => <option key={id} value={id}>{names.get(id) || id}</option>)}</select></label>
            <label className="field">Type<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All types</option>{['Event', 'Warning', 'Error'].map((label) => <option key={label}>{label}</option>)}</select></label>
        </div>
        <Notice error={error} />
        {!entries && !error && <p>Loading activity…</p>}
        {groups.map(([day, items]) => <div key={day}><h3 className="activity-day">{day}</h3>{items.map((entry) => {
            const severity = types[entry.level] || types.info;
            const Icon = severity.icon;
            const name = names.get(entry.deviceId) || entry.deviceId || 'System';
            const registered = devices.some((d) => d.id === entry.deviceId);
            return <details className="activity-entry" key={entry.id}>
                <summary><time dateTime={new Date(entry.timestamp).toISOString()}>{new Date(entry.timestamp).toLocaleTimeString()}</time><strong className="activity-device"><Server size={17} />{name}</strong><span className={`activity-type activity-${severity.label.toLowerCase()}`}><Icon size={16} />{severity.label}</span><span className="activity-message">{entry.message}</span></summary>
                <div className="activity-details"><p>Source: {name} · Device ID: {entry.deviceId || 'system'}</p><p>{new Date(entry.timestamp).toLocaleString()} · Event ID: {entry.id}</p>{registered && <Link className="text-link" to={`/monitor/devices/${entry.deviceId}`}>Open device details</Link>}</div>
            </details>;
        })}</div>)}
        {entries && !groups.length && <p className="hint">{entries.length ? 'No events match these filters.' : 'Device connection changes, actions, warnings, and errors will appear here.'}</p>}
    </section>;
}
