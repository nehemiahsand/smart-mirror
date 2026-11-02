import React from 'react';
import PropTypes from 'prop-types';
import './GameTracker.css';
export default function GameTracker({ game }) {
    const football = game.sport === 'football';
    const periodCount = Math.max(4, game.home.periods?.length || 0, game.away.periods?.length || 0);
    return <section className="live-game-tracker" aria-label="Live game tracker">
        <header className="tracker-header"><span>{football ? game.league?.includes('college') ? 'College football' : 'NFL football' : 'NBA basketball'}</span><span className={game.stale ? 'tracker-stale' : 'tracker-live'}>{game.stale ? 'Last known · Stale' : 'Live'}</span></header>
        {game.stale && <p className="tracker-stale-note">Updates interrupted · Score and clock are last known. Waiting for fresh data.</p>}
        <div className="tracker-scoreboard">{[game.home, game.away].map((team) => <div className="tracker-team" key={team.id} style={{ '--team-color': team.color || '#aab8c7' }}>
            {team.logo && <img src={team.logo} alt="" />}
            <div><strong>{team.abbreviation || team.name}</strong><small>{team.name}</small>{game.possession === team.id && football && <span className="tracker-possession">● Possession</span>}</div>
            <b className="tracker-score">{team.score ?? '—'}</b>
        </div>)}</div>
        <p className="tracker-game-status">{game.status || [game.period != null ? `${football ? 'Quarter' : 'Period'} ${game.period}` : null, game.clock].filter(Boolean).join(' · ') || 'Game status unavailable'}</p>
        {football && <>
            <div className="tracker-situation"><strong>{game.downDistance || 'Down & distance unavailable'}</strong><span>{game.fieldPosition || 'Field position unavailable'}</span></div>
            <div className="tracker-field" aria-hidden="true">{[10,20,30,40,50,40,30,20,10].map((n,i) => <span key={i}>{n}</span>)}</div>
        </>}
        {!football && game.leaders?.length > 0 && <div className="tracker-leaders">{game.leaders.slice(0, 6).map((leader, i) => <div key={i}><small>{leader.team} · {leader.category}</small><strong>{leader.value ?? '—'}</strong><span>{leader.name}</span></div>)}</div>}
        <div className="tracker-detail-grid"><div><h3>Latest plays</h3>{game.recentPlays?.length ? game.recentPlays.slice(0, 4).map((play, i) => <div className="tracker-play" key={play.id || i}><p>{play.text}</p><small>{[play.period != null ? `${football ? 'Q' : 'Period '}${play.period}` : null, play.clock].filter(Boolean).join(' · ') || 'Play time unavailable'}</small></div>) : <p className="tracker-unavailable">Play-by-play unavailable. Scoreboard remains available.</p>}</div>
            <div><h3>By {football ? 'quarter' : 'period'}</h3><div className="tracker-linescore" style={{ '--periods': periodCount }}><span>TEAM</span>{Array.from({ length: periodCount }, (_, i) => <span key={i}>{i < 4 ? i + 1 : `OT${i - 3}`}</span>)}<span>T</span>{[game.home, game.away].map((team) => <React.Fragment key={team.id}><strong>{team.abbreviation}</strong>{Array.from({ length: periodCount }, (_, i) => <span key={i}>{team.periods?.[i] ?? '—'}</span>)}<strong>{team.score ?? '—'}</strong></React.Fragment>)}</div><p className="tracker-updated">{game.observedAt ? `Updated ${new Date(game.observedAt).toLocaleTimeString()}` : 'Update time unavailable'}{!game.detailsAvailable && ' · Detailed statistics unavailable'}</p></div>
        </div>
    </section>;
}
GameTracker.propTypes = { game: PropTypes.object.isRequired };
