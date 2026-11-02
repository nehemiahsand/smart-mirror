import { Button } from '../components/NexusUI';
import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import { useNexus } from '../state/NexusProvider';
import { Disclosure, Notice, Switch, Surface } from '../components/NexusUI';
const definitions = {
    home: [
        ['timedate', 'Time & Date'],
        ['weathertemp', 'Weather, Temp & Traffic'],
        ['googlecalendar', 'Calendar & Sports'],
        ['photos', 'Photos Slideshow']
    ],
    weather: [
        ['timedate', 'Time & Date'],
        ['sunmoon', 'Sun & Moon'],
        ['temps', 'Outdoor & Indoor Temp'],
        ['hourly', 'Hourly Forecast']
    ],
    sports: [
        ['timedate', 'Time & Date'],
        ['highlights', 'Highlights / Game tracker']
    ]
};
const orderKeys = {
    home: 'widgetOrder',
    weather: 'weatherWidgetOrder',
    sports: 'sportsWidgetOrder'
};
export default function MirrorEdit() {
    const { data, refresh, request } = useNexus();
    const [draft, setDraft] = useState(null);
    const [search] = useSearchParams();
    const [page, setPage] = useState(
        ['home', 'weather', 'sports'].includes(search.get('section')) ? search.get('section') : 'home'
    );
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [sports, setSports] = useState([]);
    const [experience, setExperience] = useState(null);
    const [liveError, setLiveError] = useState('');
    const [liveBusy, setLiveBusy] = useState(false);
    const [currentRecap, setCurrentRecap] = useState(null);
    const [recapError, setRecapError] = useState('');
    const teams = [['gsw', 'Golden State Warriors'], ['auburn', 'Auburn football']];
    useEffect(() => {
        if (page !== 'sports') return;
        let active = true;
        setCurrentRecap(null);
        const load = () => {
            request('/api/sports/experience').then((value) => { if (active) { setExperience(value); setLiveError(''); } }).catch((e) => { if (active) setLiveError(e.message); });
            request('/api/console/page/sports').then((value) => {
                if (!active) return;
                const feed = value.videoFeed;
                const item = feed?.items?.[feed.selectedClipIndex || 0];
                setCurrentRecap(item ? { ...item, team: value.experience?.preferences?.team, playbackMessage: feed.playbackMessage } : null);
                setRecapError('');
            }).catch(() => { if (active) setRecapError('Current recap could not be loaded.'); });
        };
        load();
        const interval = setInterval(() => { if (!document.hidden) load(); }, 15000);
        return () => { active = false; clearInterval(interval); };
    }, [page, request, data.settings?.sports?.highlightsTeam]);
    const blocker = useBlocker(dirty);
    useEffect(() => {
        if (blocker.state !== 'blocked') return;
        if (window.confirm('Discard unsaved mirror changes?'))
            blocker.proceed();
        else blocker.reset();
    }, [blocker]);
    useEffect(() => {
        if (data.settings && !draft) setDraft(structuredClone(data.settings));
    }, [data.settings, draft]);
    useEffect(() => {
        request('/api/sports')
            .then((result) => setSports(Array.isArray(result) ? result : result.sports || []))
            .catch(() => {});
    }, [request]);
    useEffect(() => {
        if (!dirty) return;
        const warn = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => {
            window.removeEventListener('beforeunload', warn);
        };
    }, [dirty]);
    function change(update) {
        setDraft((previous) => ({ ...previous, ...update }));
        setDirty(true);
        setMessage('');
    }
    if (!draft) return <p>Loading mirror preferences…</p>;
    const widgets = [...definitions[page]].sort((a, b) => {
        const order = draft[orderKeys[page]] || [];
        return (
            (order.includes(a[0]) ? order.indexOf(a[0]) : 99) -
            (order.includes(b[0]) ? order.indexOf(b[0]) : 99)
        );
    });
    function move(index, delta) {
        const ids = widgets.map(([id]) => id);
        [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
        change({ [orderKeys[page]]: ids });
    }
    async function selectLive(selection) {
        setLiveBusy(true);
        setLiveError('');
        try { setExperience(await request('/api/sports/selection', selection)); }
        catch (e) { setLiveError(e.message); }
        finally { setLiveBusy(false); }
    }
    async function save() {
        setBusy(true);
        setError('');
        try {
            const updates = Object.fromEntries(
                Object.entries(orderKeys).map(([p, key]) => [
                    key,
                    draft[key] || definitions[p].map(([id]) => id)
                ])
            );
            Object.assign(updates, {
                pageVisibility: draft.pageVisibility || {},
                'weather.city': draft.weather.city,
                'weather.units': draft.weather.units,
                'sports.enabled': draft.sports.enabled,
                'sports.sport': draft.sports.sport,
                'sports.defaultSport':
                    draft.sports.defaultSport || draft.sports.sport,
                'sports.teams': draft.sports.teams || [],
                'sports.highlightsTeam': draft.sports.highlightsTeam || 'gsw',
                'sports.liveGames': draft.sports.liveGames !== false,
                'sports.livePriority': draft.sports.livePriority || ['auburn', 'gsw']
            });
            await request('/api/nexus/preferences', updates);
            setDirty(false);
            setMessage('Mirror preferences saved.');
            await refresh('settings');
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <label className="field">
                Mirror page
                <select value={page} onChange={(e) => setPage(e.target.value)}>
                    <option value="home">Main</option>
                    <option value="weather">Weather</option>
                    <option value="sports">Sports</option>
                </select>
            </label>
            <div className="mirror-edit-layout"><div className="mirror-edit-form"><Surface>
            <h2 className="section-title">Widgets & order</h2>
            {widgets.map(([id, name], index) => (
                <div key={id} className="widget-row">
                    <span className="muted mono">
                        {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="grow">{name}</span>
                    <Switch
                        label={`Show ${name}`}
                        checked={draft.pageVisibility?.[page]?.[id] !== false}
                        onChange={(e) =>
                            change({
                                pageVisibility: {
                                    ...draft.pageVisibility,
                                    [page]: {
                                        ...draft.pageVisibility?.[page],
                                        [id]: e.target.checked
                                    }
                                }
                            })
                        }
                    />
                    <div className="button-row">
                        <Button
                            className="icon-button"
                            disabled={index === 0 || busy}
                            onClick={() => move(index, -1)}
                            aria-label={`Move ${name} up`}
                        >
                            <ArrowUp />
                        </Button>
                        <Button
                            className="icon-button"
                            disabled={index === widgets.length - 1 || busy}
                            onClick={() => move(index, 1)}
                            aria-label={`Move ${name} down`}
                        >
                            <ArrowDown />
                        </Button>
                    </div>
                </div>
            ))}
            <p className="hint">
                Show, hide, and reorder widgets on this page.
            </p>
            </Surface><Surface><h2 className="section-title">Content preferences</h2>
            {page === 'weather' && <Disclosure title="Weather & location" open>
                <label className="field">
                    City
                    <input
                        value={draft.weather.city}
                        onChange={(e) =>
                            change({
                                weather: {
                                    ...draft.weather,
                                    city: e.target.value
                                }
                            })
                        }
                    />
                </label>
                <label className="field">
                    Units
                    <select
                        value={draft.weather.units}
                        onChange={(e) =>
                            change({
                                weather: {
                                    ...draft.weather,
                                    units: e.target.value
                                }
                            })
                        }
                    >
                        <option value="imperial">Fahrenheit</option>
                        <option value="metric">Celsius</option>
                    </select>
                </label>
                <p className="hint">Shared location and units also update weather on Main. Widget visibility stays specific to Weather.</p>
            </Disclosure>}
            {page === 'home' && <Disclosure title="Sports scores on Main" open>
                <label className="field">
                    Preferred sport
                    <select
                        value={draft.sports.sport}
                        onChange={(e) =>
                            change({
                                sports: {
                                    ...draft.sports,
                                    sport: e.target.value,
                                    defaultSport: e.target.value,
                                    enabled: true,
                                    teams: []
                                }
                            })
                        }
                    >
                        {(sports.length
                            ? sports
                            : [
                                  {
                                      id: draft.sports.sport,
                                      name: draft.sports.sport
                                  }
                              ]
                        ).map((sport) => (
                            <option value={sport.id} key={sport.id}>
                                {sport.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="field">
                    Team IDs (comma separated)
                    <input
                        value={(draft.sports.teams || []).join(', ')}
                        onChange={(e) =>
                            change({
                                sports: {
                                    ...draft.sports,
                                    teams: e.target.value
                                        .split(',')
                                        .map((team) => team.trim())
                                        .filter(Boolean)
                                }
                            })
                        }
                    />
                </label>
                <p className="hint">
                    Team filters apply to scores. Highlight team and live games are configured on the Sports page.
                </p>
            </Disclosure>}
            {page === 'sports' && <>
                <label className="field">Highlights team<select value={draft.sports.highlightsTeam || 'gsw'} onChange={(e) => change({ sports: { ...draft.sports, highlightsTeam: e.target.value } })}>{teams.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
                <p className="hint">{draft.sports.highlightsTeam === 'auburn' ? 'ESPN College Football' : 'Warriors game recaps'} · Up to 10 completed games with scores and box scores. Choose Save changes below to apply the highlight team.</p>
                <div className="row setting-row"><div><strong>Show live games instead of highlights</strong><small>Tracks Auburn and Warriors, regardless of highlights team.</small></div><Switch label="Show live games instead of highlights" checked={draft.sports.liveGames !== false} onChange={(e) => change({ sports: { ...draft.sports, liveGames: e.target.checked } })} /></div>
                <h3>Live-game priority</h3><p className="hint">First live team wins when games overlap.</p>
                {(draft.sports.livePriority || ['auburn', 'gsw']).map((id, index, order) => <div key={id} className="sports-priority-row"><small>{index + 1}</small><span>{teams.find(([key]) => key === id)?.[1]}</span><Button className="icon-button" aria-label={`Move ${id} up`} disabled={index === 0 || busy} onClick={() => { const next = [...order]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; change({ sports: { ...draft.sports, livePriority: next } }); }}><ArrowUp /></Button></div>)}
                <h3 className="section-title">Current recap</h3>
                {currentRecap && currentRecap.team === (draft.sports.highlightsTeam || 'gsw') ? <div>
                    <strong>{currentRecap.title}</strong>
                    <p className="hint">{currentRecap.game?.dateFormatted} · {currentRecap.channelTitle}</p>
                    {currentRecap.playbackMessage && <p className="hint">{currentRecap.playbackMessage}</p>}
                    {(currentRecap.watchUrl || currentRecap.videoId) && <a className="button" href={currentRecap.watchUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(currentRecap.videoId)}`} target="_blank" rel="noopener noreferrer">Open highlights</a>}
                </div> : <p className="hint">{dirty ? 'Save changes to load this team’s recap.' : 'No current recap available.'}</p>}
                <Notice error={recapError} />
                <h3 className="section-title">Live games</h3>
                {experience?.checkedAt && <p className="hint">Last checked {new Date(experience.checkedAt).toLocaleTimeString()}</p>}
                {experience?.failures?.length > 0 && <p className="hint" role="status">Updates interrupted for {experience.failures.map((id) => teams.find(([team]) => team === id)?.[1] || id).join(', ')}. Available games remain listed; retained readings are labeled stale.</p>}
                {!experience && !liveError && <p className="hint">Checking live game availability…</p>}
                {experience?.games?.map((game) => <div key={game.id} className="row setting-row"><div><strong>{game.away.abbreviation} {game.away.score ?? '—'} · {game.home.abbreviation} {game.home.score ?? '—'}</strong><small>{game.stale ? 'Last known · Stale' : game.status || 'In progress'}</small></div><Button disabled={liveBusy || game.stale || !!liveError} onClick={() => selectLive({ mode: 'game', gameId: game.id })}>Watch game</Button></div>)}
                {experience && !experience.games?.length && <p className="hint">{experience.failures?.length ? 'Some game feeds are unavailable; live status cannot be fully confirmed.' : 'No tracked game is live. Selected-team highlights are shown.'}</p>}
                {experience?.games?.length > 0 && <div className="button-row"><Button disabled={liveBusy || !!liveError} onClick={() => selectLive({ mode: 'highlights' })}>Keep highlights</Button><Button disabled={liveBusy || !!liveError} onClick={() => selectLive({ mode: 'auto' })}>Use priority order</Button></div>}
                {experience?.override && <p className="hint">Temporary override: {experience.override.mode === 'game' ? 'Selected game' : 'Highlights'}. Returns to automatic selection when that game ends.</p>}
                <Notice error={liveError} />
            </>}
            </Surface>
            <Button
                className="primary full section-title"
                disabled={busy || !dirty}
                onClick={save}
            >
                {busy ? 'Saving…' : 'Save changes'}
            </Button>
            <Notice error={error} message={message} />
            </div><aside className="mirror-edit-preview" aria-label="Mirror preferences preview"><h2>{page === 'home' ? 'Main' : page === 'weather' ? 'Weather' : 'Sports'}</h2><small>Preferences preview · Changes apply after saving</small><hr />
                {page === 'weather' ? <><h3>{draft.weather.city}</h3><p>{draft.weather.units === 'metric' ? 'Celsius' : 'Fahrenheit'}</p></> : page === 'home' ? <><h3>Main scoreboard</h3><p>{sports.find((s) => s.id === draft.sports.sport)?.name || draft.sports.sport}</p><small>{draft.sports.teams?.length ? `${draft.sports.teams.length} selected teams` : 'All teams'}</small></> : <><h3>{teams.find(([id]) => id === (draft.sports.highlightsTeam || 'gsw'))?.[1]}</h3><p>{draft.sports.liveGames !== false ? 'Highlights ↔ Live game' : 'Highlights'}</p><small>Priority: {(draft.sports.livePriority || ['auburn', 'gsw']).join(' → ')}</small></>}
                <hr /><small>Visible widgets</small>{widgets.filter(([id]) => draft.pageVisibility?.[page]?.[id] !== false).map(([id, name]) => <p key={id}>{name}</p>)}
            </aside></div>
        </>
    );
}
