import React from 'react';
import PropTypes from 'prop-types';
const statIds = ['firstDowns', 'thirdDownEff', 'fourthDownEff', 'totalYards', 'netPassingYards', 'rushingYards', 'rushingAttempts', 'yardsPerPass', 'yardsPerRushAttempt', 'turnovers', 'fumblesLost', 'interceptions', 'totalPenaltiesYards', 'possessionTime'];
export default function FootballBoxScore({ boxScore, game }) {
    const team = boxScore.team;
    const opponent = boxScore.opponent;
    const home = game.homeAway === 'home';
    const name = home ? game.home?.abbrev : game.away?.abbrev;
    const other = home ? game.away?.abbrev : game.home?.abbrev;
    const stats = statIds.map((id) => team.statistics?.find((stat) => stat.id === id) || opponent?.statistics?.find((stat) => stat.id === id)).filter(Boolean);
    const categories = ['passing', 'rushing', 'receiving'].map((id) => team.categories?.find((category) => category.id === id));
    return <div className="football-recap-box">
        <div className="fun-boxscore-inline-header"><span className="fun-boxscore-team-label">{name} Box Score · {game.dateFormatted}</span></div>
        <div className="football-recap-grid">
            {categories.map((category, index) => <section key={category?.id || index} className="football-recap-category"><h3>{['Passing', 'Rushing', 'Receiving'][index]}</h3>
                {!category ? <p className="fun-empty-message">Statistics unavailable</p> : <div className="fun-boxscore-scroll"><table className="fun-boxscore-table"><thead><tr><th className="fun-boxscore-player-col">Player</th>{category.labels.map((label, i) => <th key={i}>{label}</th>)}</tr></thead><tbody>
                    {category.players.map((player, i) => <tr key={i}><td className="fun-boxscore-player-col">{player.name}</td>{category.labels.map((_, j) => <td key={j}>{player.stats[j] ?? '—'}</td>)}</tr>)}
                </tbody><tfoot><tr><td className="fun-boxscore-player-col">TOTAL</td>{category.labels.map((_, i) => <td key={i}>{category.totals?.[i] ?? '—'}</td>)}</tr></tfoot></table></div>}
            </section>)}
            <section className="football-recap-category"><h3>Team comparison</h3>{stats.length ? <table className="fun-boxscore-table"><thead><tr><th className="fun-boxscore-player-col">Statistic</th><th>{name}</th><th>{other}</th></tr></thead><tbody>{stats.map((stat) => <tr key={stat.id}><td className="fun-boxscore-player-col">{stat.label}</td><td>{team.statistics?.find((s) => s.id === stat.id)?.value ?? '—'}</td><td>{opponent?.statistics?.find((s) => s.id === stat.id)?.value ?? '—'}</td></tr>)}</tbody></table> : <p className="fun-empty-message">Team statistics unavailable</p>}</section>
        </div>
    </div>;
}
FootballBoxScore.propTypes = { boxScore: PropTypes.object.isRequired, game: PropTypes.object.isRequired };
