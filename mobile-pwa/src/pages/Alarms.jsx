import { Button } from '../components/NexusUI';
import React, { useEffect, useRef, useState } from 'react';
import { AlarmClock, Box, Plus, Trash2 } from 'lucide-react';
import { DateTime } from 'luxon';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useNexus } from '../state/NexusProvider';
import {
    Confirmation,
    Disclosure,
    Heading,
    Modal,
    Notice,
    Status,
    Subnav,
    Switch
} from '../components/NexusUI';
import {
    CLOCK_ZONE,
    formatDuration,
    formatEpoch,
    localAlarmEpoch,
    isRetainedAlarm,
    isManualAlarm as isManual,
    isTerminalAlarm as terminal
} from '../utils/clockTime';

function AlarmEditor({ alarm, onClose, onSave, busy, onDelete, serverError }) {
    const [time, setTime] = useState(
        `${String(alarm?.hour ?? 7).padStart(2, '0')}:${String(alarm?.minute ?? 0).padStart(2, '0')}`
    );
    const [recurring, setRecurring] = useState(alarm?.recurring ?? false);
    const [date, setDate] = useState(
        alarm?.epoch
            ? DateTime.fromSeconds(alarm.epoch, {
                  zone: CLOCK_ZONE
              }).toISODate()
            : DateTime.now().setZone(CLOCK_ZONE).toISODate()
    );
    const [mask, setMask] = useState(alarm?.weekdayMask || 62);
    const [enabled, setEnabled] = useState(alarm?.enabled ?? true);
    const [error, setError] = useState('');
    const [offset, setOffset] = useState();
    const [choices, setChoices] = useState([]);
    function submit(e) {
        e.preventDefault();
        setError('');
        try {
            const [hour, minute] = time.split(':').map(Number);
            const value = {
                action: 'alarm.upsert',
                enabled,
                recurring,
                hour,
                minute,
                ...(alarm?.retained ? { id: alarm.id } : {})
            };
            if (recurring) {
                if (!mask) throw new Error('Select at least one weekday.');
                value.weekdayMask = mask;
            } else {
                const converted = localAlarmEpoch(date, time, offset);
                if (converted.choices) {
                    setChoices(converted.choices);
                    return;
                }
                value.epoch = converted.epoch;
            }
            onSave(value);
        } catch (e) {
            setError(e.message);
        }
    }
    return (
        <Modal
            title={alarm ? 'Edit alarm' : 'New alarm'}
            onClose={busy ? () => {} : onClose}
        >
            <form onSubmit={submit}>
                <label className="field">
                    Time
                    <input
                        type="time"
                        value={time}
                        required
                        onChange={(e) => {
                            setTime(e.target.value);
                            setOffset(undefined);
                            setChoices([]);
                        }}
                    />
                </label>
                <label className="field">
                    Type
                    <select
                        value={recurring ? 'repeat' : 'once'}
                        onChange={(e) =>
                            setRecurring(e.target.value === 'repeat')
                        }
                    >
                        <option value="once">One time</option>
                        <option value="repeat">Repeating</option>
                    </select>
                </label>
                {recurring ? (
                    <fieldset className="weekday-picker">
                        <legend>Repeat on</legend>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                            (day, bit) => (
                                <label key={day}>
                                    <input
                                        type="checkbox"
                                        checked={!!(mask & (1 << bit))}
                                        onChange={() =>
                                            setMask(
                                                (value) => value ^ (1 << bit)
                                            )
                                        }
                                    />
                                    <span>{day.slice(0, 2)}</span>
                                </label>
                            )
                        )}
                    </fieldset>
                ) : (
                    <label className="field">
                        Date
                        <input
                            type="date"
                            required
                            value={date}
                            onChange={(e) => {
                                setDate(e.target.value);
                                setOffset(undefined);
                                setChoices([]);
                            }}
                        />
                    </label>
                )}
                {choices.length > 0 && (
                    <label className="field">
                        This time occurs twice. Choose which occurrence.
                        <select
                            value={offset ?? ''}
                            required
                            onChange={(e) => setOffset(Number(e.target.value))}
                        >
                            <option value="" disabled>
                                Select occurrence
                            </option>
                            {choices.map((choice) => (
                                <option
                                    key={choice.offset}
                                    value={choice.offset}
                                >
                                    {choice.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <div className="row setting-row">
                    <span>Enabled</span>
                    <Switch
                        label="Alarm enabled"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                    />
                </div>
                <p className="hint">America/Chicago · No custom labels</p>
                <Notice error={error || serverError} />
                <div className="button-row">
                    <Button type="submit" className="primary" disabled={busy}>
                        Save alarm
                    </Button>
                    <Button type="button" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    {alarm?.retained && !isManual(alarm) && (
                        <Button
                            type="button"
                            className="danger"
                            disabled={busy}
                            onClick={onDelete}
                        >
                            Delete
                        </Button>
                    )}
                </div>
            </form>
        </Modal>
    );
}
export default function Alarms() {
    const { view } = useParams();
    const { hash } = useLocation();
    const { data, errors, request, refresh, connected } = useNexus();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [editor, setEditor] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [masterPrompt, setMasterPrompt] = useState(null);
    const [custom, setCustom] = useState(false);
    const [minutes, setMinutes] = useState(20);
    const [now, setNow] = useState(Date.now());
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            mounted.current = false;
            clearInterval(timer);
        };
    }, []);
    const snapshot = data.clock;
    const state = snapshot?.state;
    useEffect(() => {
        if (hash === '#manual' && view === 'alarms' && state) {
            const section = document.getElementById('manual');
            section?.scrollIntoView({ block: 'start' });
            section?.focus({ preventScroll: true });
        }
    }, [hash, view, !!state]);
    const available =
        connected &&
        snapshot?.online &&
        snapshot?.fresh &&
        state &&
        !state.sharpBusy &&
        !busy;
    const format = data.config?.preferences.clockFormat || '12h';
    if (!['alarms', 'timers', 'clock'].includes(view))
        return <Navigate to="/alarms/alarms" replace />;
    async function send(command) {
        await request('/api/clock/command', {
            ...command,
            requestId: crypto.randomUUID()
        });
        await refresh('clock');
        await refresh('history');
    }
    async function perform(command, turnOnMaster = false) {
        setBusy(true);
        setError('');
        setMessage('');
        let masterConfirmed = false;
        try {
            if (turnOnMaster) {
                await send({ action: 'master.set', enabled: true });
                let confirmed = false;
                for (let i = 0; i < 20 && mounted.current; i++) {
                    const latest = await request('/api/clock/state');
                    if (
                        latest.online &&
                        latest.fresh &&
                        latest.state?.masterEnabled &&
                        !latest.state.sharpBusy
                    ) {
                        confirmed = true;
                        break;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
                if (!confirmed)
                    throw new Error(
                        'Master request was acknowledged, but a ready snapshot has not arrived. The alarm/timer was not changed.'
                    );
            }
            masterConfirmed = turnOnMaster;
            await send(command);
            if (!mounted.current) return;
            setEditor(null);
            setCustom(false);
            setConfirm(null);
            setMasterPrompt(null);
            setMessage(
                'Clock acknowledged the command. Waiting for retained state to reconcile.'
            );
        } catch (e) {
            if (mounted.current)
                setError(
                    masterConfirmed
                        ? `Master is on, but the entry command did not complete: ${e.message}`
                        : e.message
                );
        } finally {
            if (mounted.current) setBusy(false);
        }
    }
    function submit(command) {
        if (!available) return;
        if (
            !state.masterEnabled &&
            (command.action === 'timer.create' ||
                ((command.action === 'alarm.upsert' ||
                    command.action.endsWith('set_enabled')) &&
                    command.enabled))
        ) {
            setEditor(null);
            setCustom(false);
            setMasterPrompt(command);
        } else perform(command);
    }
    const alarms = state?.alarms || [];
    const physical = alarms.filter(isManual);
    const smart = alarms.filter((a) => !isManual(a) && !terminal(a));
    const past = [
        ...(data.history?.alarms || []),
        ...alarms.filter((a) => !isManual(a) && terminal(a))
    ]
        .filter(
            (a, i, all) =>
                all.findIndex((b) => a.id === b.id && a.epoch === b.epoch) === i
        )
        .sort((a, b) => b.epoch - a.epoch)
        .slice(0, 10);
    const alarmText = (alarm) =>
        alarm.recurring
            ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  .filter((_, bit) => alarm.weekdayMask & (1 << bit))
                  .join(' · ')
            : `One time · ${alarm.epoch ? DateTime.fromSeconds(alarm.epoch, { zone: CLOCK_ZONE }).toFormat('MMM d, yyyy') : 'Date unavailable'}`;
    function row(alarm, previous = false) {
        const retained = isRetainedAlarm(alarm, alarms);
        const label = !alarm.enabled
            ? 'Disabled'
            : !state?.masterEnabled && !isManual(alarm)
              ? 'Suspended'
              : alarm.state;
        return (
            <div
                className={`alarm-row ${!alarm.enabled || (!state?.masterEnabled && !isManual(alarm)) ? 'muted-entry' : ''}`}
                key={`${alarm.id}-${alarm.epoch}`}
            >
                <Button
                    className="alarm-time-button"
                    disabled={!available || isManual(alarm)}
                    onClick={() => setEditor({ ...alarm, retained })}
                >
                    <span className="alarm-time mono">
                        {DateTime.fromObject({
                            hour: alarm.hour,
                            minute: alarm.minute
                        }).toFormat(format === '24h' ? 'HH:mm' : 'h:mm a')}
                    </span>
                    <small>{alarmText(alarm)}</small>
                    <small>
                        {previous ? 'Expired' : label}
                        {isManual(alarm)
                            ? ' · Physical / manual'
                            : alarm.temporary
                              ? ' · Temporary'
                              : ''}
                    </small>
                </Button>
                {isManual(alarm) ? (
                    <span className="tag">Manual</span>
                ) : previous ? (
                    <Button
                        disabled={!available}
                        onClick={() =>
                            setEditor({ ...alarm, enabled: true, retained })
                        }
                    >
                        Reuse
                    </Button>
                ) : (
                    <Switch
                        label={`Enable alarm ${alarm.hour}:${String(alarm.minute).padStart(2, '0')}`}
                        checked={alarm.enabled}
                        disabled={!available}
                        onChange={(e) =>
                            submit({
                                action: 'alarm.set_enabled',
                                id: alarm.id,
                                enabled: e.target.checked
                            })
                        }
                    />
                )}
            </div>
        );
    }
    return (
        <>
            <Heading title="Alarms">Make time for what matters.</Heading>
            <Subnav
                base="alarms"
                items={['alarms', 'timers', 'clock'].map((key) => [
                    key,
                    key[0].toUpperCase() + key.slice(1)
                ])}
            />
            <div className="content-column alarms-content">
                {!state && (
                    <div className="surface">
                        <AlarmClock />
                        <h2>Waiting for your clock</h2>
                        <p>
                            The clock needs a valid retained state before it can
                            be controlled.
                        </p>
                        <p className="hint">
                            {snapshot?.error ||
                                errors.clock ||
                                'Connecting to MQTT…'}
                        </p>
                    </div>
                )}
                {state && (!snapshot.online || !snapshot.fresh) && (
                    <p className="notice error" role="status">
                        Clock offline or awaiting a fresh snapshot. Showing last
                        known state.
                    </p>
                )}
                {state?.sharpBusy && (
                    <p className="notice">
                        Sharp controller is busy. Controls will return when it
                        is ready.
                    </p>
                )}
                {data.clockEvent && (
                    <p className="notice" role="status">
                        {data.clockEvent.type.replaceAll('.', ' · ')} · Awaiting
                        retained state
                    </p>
                )}
                {view === 'alarms' && state && (
                    <>
                        <section className="hero">
                            <div className="orbit" />
                            <div className="row">
                                <span className="eyebrow">
                                    Next native occurrence
                                </span>
                                <AlarmClock />
                            </div>
                            <div className="alarm-time hero-time mono">
                                {formatEpoch(state.next?.epoch, format)}
                            </div>
                            <p>
                                {state.next
                                    ? DateTime.fromSeconds(state.next.epoch, {
                                          zone: CLOCK_ZONE
                                      }).toFormat('ccc, MMM d')
                                    : 'No eligible occurrence'}
                            </p>
                            <p className="hint">
                                {state.sharpAlarmGateEnabled
                                    ? 'Sharp alarm gate enabled'
                                    : 'Sharp alarm gate off · Native output disabled'}
                            </p>
                        </section>
                        <h2 className="section-title">Scheduled alarms</h2>
                        {smart.length ? (
                            smart.map((a) => row(a))
                        ) : (
                            <p className="hint">No smart alarms scheduled.</p>
                        )}
                        <h2 id="manual" tabIndex={-1} className="section-title">
                            Physical / manual
                        </h2>
                        {physical.length ? (
                            physical.map((a) => row(a))
                        ) : (
                            <p className="hint">No physical alarm reported.</p>
                        )}
                        <h2 className="section-title">
                            Previous <small>{past.length} / 10</small>
                        </h2>
                        {past.length ? (
                            past.map((a) => row(a, true))
                        ) : (
                            <p className="hint">
                                Expired one-time alarms appear here when
                                observed.
                            </p>
                        )}
                        <div className="floating-add">
                            <Button
                                className="primary"
                                aria-label="Create alarm"
                                disabled={!available || alarms.length >= 10}
                                onClick={() => setEditor({})}
                            >
                                <Plus />
                            </Button>
                        </div>
                        <p className="hint">
                            {alarms.length} / 10 device slots used. History does
                            not free retained device slots.
                        </p>
                    </>
                )}
                {view === 'timers' && (
                    <>
                        <h2>Start a timer</h2>
                        <div className="preset-row">
                            <Button
                                className="primary"
                                disabled={
                                    !available || state.timers.length >= 5
                                }
                                onClick={() => setCustom(true)}
                            >
                                Custom
                            </Button>
                            {[2, 5, 10, 20, 30].map((min) => (
                                <Button
                                    key={min}
                                    disabled={
                                        !available || state.timers.length >= 5
                                    }
                                    onClick={() =>
                                        submit({
                                            action: 'timer.create',
                                            minutes: min
                                        })
                                    }
                                >
                                    {min} min
                                </Button>
                            ))}
                        </div>
                        <h2 className="section-title">
                            {state?.masterEnabled
                                ? 'Timers'
                                : 'Suspended timers'}
                        </h2>
                        {state?.timers.map((timer) => (
                            <section
                                className={`surface ${!timer.enabled || !state.masterEnabled ? 'muted-entry' : ''}`}
                                key={timer.id}
                            >
                                <div className="row">
                                    <div>
                                        <span className="eyebrow">
                                            Timer #{timer.id}
                                        </span>
                                        <div className="alarm-time mono">
                                            {formatDuration(
                                                !state.masterEnabled ||
                                                    !timer.enabled
                                                    ? timer.pausedRemainingSeconds
                                                    : timer.targetEpoch -
                                                          (snapshot.state
                                                              .epoch +
                                                              (now -
                                                                  snapshot.updatedAt) /
                                                                  1000)
                                            )}
                                        </div>
                                    </div>
                                    <Switch
                                        label={`Enable timer ${timer.id}`}
                                        disabled={!available}
                                        checked={timer.enabled}
                                        onChange={(e) =>
                                            submit({
                                                action: 'timer.set_enabled',
                                                id: timer.id,
                                                enabled: e.target.checked
                                            })
                                        }
                                    />
                                </div>
                                <div className="row">
                                    <span className="hint">
                                        {!state.masterEnabled
                                            ? 'Suspended'
                                            : timer.state}
                                    </span>
                                    <Button
                                        className="icon-button"
                                        aria-label="Delete timer"
                                        disabled={!available}
                                        onClick={() =>
                                            setConfirm({
                                                title: 'Delete timer?',
                                                command: {
                                                    action: 'timer.delete',
                                                    id: timer.id
                                                }
                                            })
                                        }
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            </section>
                        ))}
                    </>
                )}
                {view === 'clock' && (
                    <>
                        <section className="surface">
                            <div className="row">
                                <h2>Sharp smart clock</h2>
                                <Status online={snapshot?.online} />
                            </div>
                            <dl className="metrics">
                                {Object.entries({
                                    Device: 'smart-clock',
                                    'Wi-Fi': state
                                        ? state.wifiConnected
                                            ? 'Connected'
                                            : 'Disconnected'
                                        : 'Unknown',
                                    MQTT: snapshot?.brokerConnected
                                        ? state?.mqttConnected
                                            ? 'Connected · TLS'
                                            : 'Broker connected'
                                        : 'Disconnected',
                                    Time: state
                                        ? `${formatEpoch(state.epoch, format)} · ${state.timeStatus}`
                                        : 'Unknown',
                                    Controller: state
                                        ? state.sharpBusy
                                            ? 'Busy'
                                            : 'Idle'
                                        : 'Unknown',
                                    Mode: state?.controlMode || 'Unknown'
                                }).map(([name, value]) => (
                                    <div key={name}>
                                        <dt>{name}</dt>
                                        <dd>{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            {state?.lastSharpError && (
                                <Notice error={state.lastSharpError} />
                            )}
                        </section>
                        <div className="row setting-row">
                            <div>
                                <strong>Smart master</strong>
                                <small>Suspends smart alarms and timers</small>
                            </div>
                            <Switch
                                label="Smart master"
                                disabled={!available}
                                checked={state?.masterEnabled}
                                onChange={(e) =>
                                    perform({
                                        action: 'master.set',
                                        enabled: e.target.checked
                                    })
                                }
                            />
                        </div>
                        <div className="row setting-row">
                            <div>
                                <strong>Sharp alarm gate</strong>
                                <small>Allows the native clock to ring</small>
                            </div>
                            <Switch
                                label="Sharp alarm gate"
                                disabled={!available}
                                checked={state?.sharpAlarmGateEnabled}
                                onChange={(e) =>
                                    perform({
                                        action: 'sharp_alarm.set_enabled',
                                        enabled: e.target.checked
                                    })
                                }
                            />
                        </div>
                        <div className="row setting-row">
                            <span>Native alarm output</span>
                            <span>
                                {state
                                    ? state.sharpAlarmOutputEnabled
                                        ? 'Enabled'
                                        : 'Disabled'
                                    : 'Unknown'}
                            </span>
                        </div>
                        <p className="hint">
                            America/Chicago. Manual alarms remain eligible with
                            master off. Only the programmed native occurrence
                            remains if the ESP fails. Ringing is inferred.
                        </p>
                        <div className="reserved">
                            <Box />
                            <div>
                                <h3>Clock visualization</h3>
                                <small>
                                    Reserved for the interactive hardware view.
                                </small>
                            </div>
                        </div>
                        <Disclosure title="Maintenance">
                            <div className="button-row">
                                {['sync', 'reset'].map((action) => (
                                    <Button
                                        key={action}
                                        disabled={!available}
                                        onClick={() =>
                                            setConfirm({
                                                title: `${action === 'sync' ? 'Synchronize' : 'Reset'} clock?`,
                                                text:
                                                    action === 'sync'
                                                        ? 'Synchronization may briefly blank the Sharp display.'
                                                        : 'This sends the guarded firmware reset command.',
                                                command: {
                                                    action: `clock.${action}`,
                                                    confirm: true
                                                }
                                            })
                                        }
                                    >
                                        {action === 'sync'
                                            ? 'Sync clock'
                                            : 'Reset clock'}
                                    </Button>
                                ))}
                            </div>
                        </Disclosure>
                        <Disclosure title="Diagnostics">
                            <p className="hint">
                                Raw outputs bypass the logical controls. Confirm
                                each hardware pulse.
                            </p>
                            <div className="button-row">
                                {['hour', 'minute', 'alarm', 'time'].map(
                                    (button) => (
                                        <Button
                                            key={button}
                                            disabled={!available}
                                            onClick={() =>
                                                setConfirm({
                                                    title: `Test ${button.toUpperCase()} output?`,
                                                    command: {
                                                        action: 'diagnostic.button',
                                                        button,
                                                        confirm: true
                                                    }
                                                })
                                            }
                                        >
                                            {button.toUpperCase()}
                                        </Button>
                                    )
                                )}
                            </div>
                        </Disclosure>
                    </>
                )}
                <Notice error={error || errors.clock} message={message} />
            </div>
            {editor && (
                <AlarmEditor
                    alarm={Object.keys(editor).length ? editor : null}
                    busy={busy}
                    serverError={error}
                    onClose={() => setEditor(null)}
                    onSave={submit}
                    onDelete={() => {
                        const id = editor.id;
                        setEditor(null);
                        setConfirm({
                            title: 'Delete alarm?',
                            command: { action: 'alarm.delete', id }
                        });
                    }}
                />
            )}
            {custom && (
                <Modal title="Custom timer" onClose={() => setCustom(false)}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            submit({
                                action: 'timer.create',
                                minutes: Number(minutes)
                            });
                        }}
                    >
                        <label className="field">
                            Minutes
                            <input
                                type="number"
                                min="1"
                                max="1439"
                                required
                                value={minutes}
                                onChange={(e) => setMinutes(e.target.value)}
                            />
                        </label>
                        <Notice error={error} />
                        <Button
                            type="submit"
                            className="primary"
                            disabled={busy}
                        >
                            Start timer
                        </Button>
                    </form>
                </Modal>
            )}
            {confirm && (
                <Confirmation
                    title={confirm.title}
                    text={
                        confirm.text ||
                        'This changes the clock’s retained configuration.'
                    }
                    busy={busy}
                    onClose={() => setConfirm(null)}
                    onConfirm={() => perform(confirm.command)}
                    error={error}
                />
            )}
            {masterPrompt && (
                <Modal
                    title="Smart master is off"
                    onClose={busy ? () => {} : () => setMasterPrompt(null)}
                >
                    <p>
                        Turn on the master to activate this entry, or keep it
                        suspended. Physical/manual alarms remain separate.
                    </p>
                    <Notice error={error} />
                    <div className="button-row">
                        <Button
                            className="primary"
                            disabled={busy}
                            onClick={() => perform(masterPrompt, true)}
                        >
                            Turn on master and enable
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={() => perform(masterPrompt)}
                        >
                            Keep suspended
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={() => setMasterPrompt(null)}
                        >
                            Cancel
                        </Button>
                    </div>
                </Modal>
            )}
        </>
    );
}
