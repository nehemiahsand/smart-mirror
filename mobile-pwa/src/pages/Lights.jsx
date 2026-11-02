import { Button } from '../components/NexusUI';
import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowUpRight,
    LampDesk,
    Monitor as MonitorIcon,
    Plus,
    Trash2,
    Check
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ColorInput, Slider } from '@mantine/core';
import { savedPresets, presetBackground, pairBackground } from '../utils/lightPresets';
import { useNexus } from '../state/NexusProvider';
import {
    Disclosure,
    Heading,
    Modal,
    Notice,
    Switch,
    Surface
} from '../components/NexusUI';

export function Brightness({ value, disabled, onCommit, label }) {
    const [local, setLocal] = useState(value ?? 0);
    const timer = useRef();
    const changing = useRef(false);
    const commit = useRef(onCommit);
    commit.current = onCommit;
    useEffect(() => {
        if (!changing.current) setLocal(value ?? 0);
    }, [value]);
    useEffect(() => () => clearTimeout(timer.current), []);
    function finish(value) {
        clearTimeout(timer.current);
        changing.current = false;
        commit.current(Number(value));
    }
    return (
        <label className="brightness">
            <span className="row">
                <span>Brightness</span>
                <span className="mono">{value == null && !changing.current ? 'Unavailable' : `${local}%`}</span>
            </span>
            <Slider
                min={0}
                max={100}
                step={1}
                thumbLabel={label}
                thumbValueText={(number) => `${number}%`}
                disabled={disabled}
                value={local}
                onChange={(next) => {
                    changing.current = true;
                    setLocal(next);
                    clearTimeout(timer.current);
                    timer.current = setTimeout(() => commit.current(next), 200);
                }}
                onChangeEnd={finish}
            />
        </label>
    );
}
function LightColor({ value = '#38b7a6', disabled, label, onCommit }) {
    const [local, setLocal] = useState(value);
    const timer = useRef();
    const dirty = useRef(false);
    const commit = useRef(onCommit);
    commit.current = onCommit;
    useEffect(() => {
        if (!dirty.current) setLocal(value);
    }, [value]);
    useEffect(() => () => clearTimeout(timer.current), []);
    function finish(color) {
        clearTimeout(timer.current);
        if (dirty.current && /^#[0-9a-f]{6}$/i.test(color)) {
            dirty.current = false;
            commit.current(color);
        }
    }
    return (
        <ColorInput
            label="Color"
            aria-label={label}
            format="hex"
            value={local}
            disabled={disabled}
            className="light-color-input"
            size="md"
            popoverProps={{ withinPortal: true }}
            onChange={(color) => {
                setLocal(color);
                dirty.current = true;
                clearTimeout(timer.current);
                if (/^#[0-9a-f]{6}$/i.test(color))
                    timer.current = setTimeout(() => finish(color), 250);
            }}
            onChangeEnd={finish}
            onBlur={() => finish(local)}
        />
    );
}
function FavoriteEditor({ lights, onSave, config, onClose }) {
    const [draft, setDraft] = useState(structuredClone(config));
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [mapping, setMapping] = useState({});
    const [favoriteColors, setFavoriteColors] = useState({});
    function presets(light) {
        return Object.entries(light.presets || {}).filter(
            ([id, value]) =>
                Number(id) > 0 && value && typeof value === 'object'
        );
    }
    return (
        <Modal title="Lighting favorites" onClose={busy ? () => {} : onClose}>
            {lights.map((light) => (
                <div key={light.id}>
                    <h3>{light.name}</h3>
                    <div className="preset-row">
                        {draft.devices
                            .find((d) => d.id === light.id)
                            ?.favorites?.map((favorite, i) => (
                                <Button
                                    key={i}
                                    onClick={() =>
                                        setDraft((d) => ({
                                            ...d,
                                            devices: d.devices.map((device) =>
                                                device.id === light.id
                                                    ? {
                                                          ...device,
                                                          favorites:
                                                              device.favorites.filter(
                                                                  (_, index) =>
                                                                      index !==
                                                                      i
                                                              )
                                                      }
                                                    : device
                                            )
                                        }))
                                    }
                                >
                                    {favorite.name} ×
                                </Button>
                            ))}
                    </div>
                    <label className="field">
                        Add saved WLED preset
                        <select
                            defaultValue=""
                            onChange={(e) => {
                                if (!e.target.value) return;
                                const presetId = Number(e.target.value);
                                const name =
                                    light.presets[presetId]?.n ||
                                    `Preset ${presetId}`;
                                setDraft((d) => ({
                                    ...d,
                                    devices: d.devices.map((device) =>
                                        device.id === light.id
                                            ? {
                                                  ...device,
                                                  favorites: [
                                                      ...(device.favorites ||
                                                          []),
                                                      { name, presetId }
                                                  ].slice(0, 8)
                                              }
                                            : device
                                    )
                                }));
                                e.target.value = '';
                            }}
                        >
                            <option value="">Choose preset</option>
                            {presets(light).map(([id, p]) => (
                                <option key={id} value={id}>
                                    {p.n || `Preset ${id}`}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="field">
                        Add favorite color
                        <input
                            type="color"
                            defaultValue="#38b7a6"
                            onChange={(e) =>
                                setFavoriteColors((previous) => ({
                                    ...previous,
                                    [light.id]: e.target.value
                                }))
                            }
                        />
                    </label>
                    <Button
                        disabled={
                            (draft.devices.find(
                                (device) => device.id === light.id
                            )?.favorites?.length || 0) >= 8
                        }
                        onClick={() => {
                            const color = favoriteColors[light.id] || '#38b7a6';
                            setDraft((previous) => ({
                                ...previous,
                                devices: previous.devices.map((device) =>
                                    device.id === light.id
                                        ? {
                                              ...device,
                                              favorites: [
                                                  ...(device.favorites || []),
                                                  {
                                                      name: color.toUpperCase(),
                                                      color
                                                  }
                                              ]
                                          }
                                        : device
                                )
                            }));
                        }}
                    >
                        Add color favorite
                    </Button>
                </div>
            ))}
            <h3 className="section-title">Paired group presets</h3>
            {draft.groupPresets.map((preset, index) => (
                <div className="row setting-row" key={index}>
                    <span>{preset.name}</span>
                    <Button
                        className="icon-button"
                        aria-label={`Remove ${preset.name}`}
                        onClick={() =>
                            setDraft((d) => ({
                                ...d,
                                groupPresets: d.groupPresets.filter(
                                    (_, i) => i !== index
                                )
                            }))
                        }
                    >
                        <Trash2 />
                    </Button>
                </div>
            ))}
            <label className="field">
                Group favorite name
                <input
                    maxLength="32"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                />
            </label>
            {lights.map((light) => (
                <label key={light.id} className="field">
                    {light.name} preset
                    <select
                        value={mapping[light.id] || ''}
                        onChange={(e) =>
                            setMapping((m) => ({
                                ...m,
                                [light.id]: Number(e.target.value)
                            }))
                        }
                    >
                        <option value="">Choose saved preset</option>
                        {presets(light).map(([id, p]) => (
                            <option key={id} value={id}>
                                {p.n || `Preset ${id}`}
                            </option>
                        ))}
                    </select>
                </label>
            ))}
            <Button
                disabled={
                    !groupName.trim() ||
                    lights.some((light) => !mapping[light.id]) ||
                    draft.groupPresets.length >= 8
                }
                onClick={() => {
                    setDraft((d) => ({
                        ...d,
                        groupPresets: [
                            ...d.groupPresets,
                            { name: groupName.trim(), devices: mapping }
                        ]
                    }));
                    setGroupName('');
                    setMapping({});
                }}
            >
                <Plus /> Add pair
            </Button>
            <Notice error={error} />
            <Button
                className="primary full section-title"
                disabled={busy}
                onClick={async () => {
                    setBusy(true);
                    try {
                        await onSave(draft);
                        onClose();
                    } catch (e) {
                        setError(e.message);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                Save favorites
            </Button>
        </Modal>
    );
}
export default function Lights() {
    const { data, errors, connected, request, refresh, commands } = useNexus();
    const lights = data.lights?.lights || [];
    const groupPresets = data.lights?.groupPresets || data.config?.groupPresets || [];
    const { error, message, pending, send } = commands.lighting;
    const [favorites, setFavorites] = useState(false);
    const groupDisabled =
        !connected ||
        !!errors.lights ||
        Object.values(pending).some(Boolean) ||
        !lights.some((l) => l.online);
    const mixed =
        lights.length > 1 &&
        lights.some(
            (l) =>
                l.state?.on !== lights[0].state?.on
        );
    const allOn =
        lights.length > 0 &&
        lights.every((light) => light.online && light.state?.on);
    function colorInput(id, value, disabled) {
        return (
            <LightColor
                value={value}
                disabled={disabled}
                label={`${id === 'all' ? 'All lights' : lights.find((light) => light.id === id)?.name} color`}
                onCommit={(color) => send(id, { color })}
            />
        );
    }
    return (
        <>
            <Heading title="Lights">A better light for your setup.</Heading>
            <div className="content-column lighting-dashboard">
                <Surface className="lighting-group">
                    <div className="row">
                        <div>
                            <span className="eyebrow">Group control</span>
                            <h2 className="large-title">All lights</h2>
                            <small>
                                Desk + Monitor{mixed ? ' · Mixed state' : ''}
                            </small>
                        </div>
                        <Switch
                            label="All lights power"
                            checked={allOn}
                            disabled={groupDisabled}
                            onChange={(e) =>
                                send('all', { on: mixed ? true : e.target.checked })
                            }
                        />
                    </div>
                    <Brightness
                        label="All lights brightness"
                        value={
                            lights.length && lights.every((light) => Number.isFinite(light.state?.bri))
                                ? Math.round(
                                      ((lights.reduce(
                                          (n, light) =>
                                              n + (light.state?.bri || 0),
                                          0
                                      ) /
                                          lights.length) *
                                          100) /
                                          255
                                  )
                                : undefined
                        }
                        disabled={
                            !connected ||
                            !!errors.lights ||
                            !lights.some((light) => light.online) ||
                            lights.some((light) => pending[light.id])
                        }
                        onCommit={(brightness) => send('all', { brightness })}
                    />
                    <h3 className="section-title">Together · Paired presets</h3>
                    <div className="preset-row compact-presets">
                        {groupPresets.map((preset) => {
                            const members = Object.entries(preset.devices);
                            const selected = members.length > 0 && members.every(([id, number]) => lights.find((l) => l.id === id)?.state?.ps === number);
                            return <Button key={preset.name} className={`preset-button ${selected ? 'selected' : ''}`}
                                style={{ '--preset-background': pairBackground(preset, lights) }}
                                aria-pressed={selected}
                                title={members.map(([id, n]) => `${lights.find((l) => l.id === id)?.name || id}: preset ${n}`).join(' · ')}
                                disabled={groupDisabled || members.some(([id, n]) => !lights.find((l) => l.id === id)?.online || !lights.find((l) => l.id === id)?.presets?.[n])}
                                onClick={() => send('all', { groupPreset: preset.name })}>
                                {pending.all ? 'Applying…' : preset.name}{selected && <Check size={14} />}
                            </Button>;
                        })}
                    </div>
                    <Disclosure title="Advanced · Group color">
                        {colorInput('all', undefined, groupDisabled)}
                    </Disclosure>
                </Surface>
                {lights.map((light, index) => {
                    const disabled =
                        !connected ||
                        !!errors.lights ||
                        !light.online ||
                        !!pending[light.id] ||
                        !!pending.all;
                    const rgb = light.state?.seg?.[0]?.col?.[0];
                    const color = rgb
                        ? `#${rgb
                              .slice(0, 3)
                              .map((n) => n.toString(16).padStart(2, '0'))
                              .join('')}`
                        : undefined;
                    return (
                        <Surface className="light-surface" key={light.id}>
                            <div className="row">
                                <div className="row">
                                    <span className="device-glyph">
                                        {index ? <MonitorIcon /> : <LampDesk />}
                                    </span>
                                    <div>
                                        <h2>{light.name}</h2>
                                        <small>
                                            {light.error === 'not_configured'
                                                ? 'Not configured'
                                                : light.online
                                                  ? light.state?.on
                                                      ? 'WLED · On'
                                                      : 'WLED · Off'
                                                  : 'Offline · Last known state'}
                                        </small>
                                    </div>
                                </div>
                                <Switch
                                    label={`${light.name} power`}
                                    checked={light.state?.on}
                                    disabled={disabled}
                                    onChange={(e) =>
                                        send(light.id, { on: e.target.checked })
                                    }
                                />
                            </div>
                            <Brightness
                                label={`${light.name} brightness`}
                                value={Number.isFinite(light.state?.bri) ? Math.round((light.state.bri * 100) / 255) : undefined}
                                disabled={
                                    !connected ||
                                    !!errors.lights ||
                                    !light.online ||
                                    !!pending.all
                                }
                                onCommit={(brightness) =>
                                    send(light.id, { brightness })
                                }
                            />
                            <div className="preset-row compact-presets" aria-label={`${light.name} saved presets`}>
                                {savedPresets(light).map(([id, preset]) => (
                                    <Button key={id} className={`preset-button ${light.state?.ps === Number(id) ? 'selected' : ''}`}
                                        style={{ '--preset-background': presetBackground(preset) }}
                                        aria-pressed={light.state?.ps === Number(id)} disabled={disabled}
                                        onClick={() => send(light.id, { presetId: Number(id) })}>
                                        {pending[light.id] ? 'Applying…' : preset.n || `Preset ${id}`}
                                        {light.state?.ps === Number(id) && <Check size={14} />}
                                    </Button>
                                ))}
                            </div>
                            {!savedPresets(light).length && <p className="hint">{light.online ? 'No saved WLED presets.' : 'Presets will load when this board connects.'}</p>}
                            <div className="preset-row">
                                {(light.favorites || []).filter((favorite) => favorite.color || favorite.name !== light.presets?.[favorite.presetId]?.n).map((favorite, i) => (
                                    <Button key={i} className="preset-button" style={{ '--preset-background': favorite.color || presetBackground(light.presets?.[favorite.presetId]) }}
                                        disabled={disabled} onClick={() => send(light.id, favorite.presetId ? { presetId: favorite.presetId } : { color: favorite.color })}>{favorite.name}</Button>
                                ))}
                            </div>
                            <Disclosure title="Advanced · Custom color & WLED">
                                {colorInput(light.id, color, disabled)}
                                {light.address ? (
                                    <a
                                        className="button"
                                        href={light.address}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Open WLED <ArrowUpRight />
                                    </a>
                                ) : (
                                    <Link to="/settings/connections">
                                        Configure connection
                                    </Link>
                                )}
                            </Disclosure>
                        </Surface>
                    );
                })}
                {!lights.length && <p>Loading lighting connections…</p>}
                <Button
                    disabled={!data.config}
                    onClick={() => setFavorites(true)}
                >
                    Manage favorites & paired presets
                </Button>
                <Notice error={error || errors.lights} message={message} />
            </div>
            {favorites && (
                <FavoriteEditor
                    config={{ ...data.config, groupPresets }}
                    lights={lights}
                    onClose={() => setFavorites(false)}
                    onSave={async (config) => {
                        await request('/api/nexus/config', config);
                        await refresh('config');
                        await refresh('lights');
                    }}
                />
            )}
        </>
    );
}
