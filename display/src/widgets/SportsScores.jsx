import { useState, useEffect } from 'react';
import './SportsScores.css';
import { apiFetch } from '../api/apiClient';

function SportsScores({ sport = 'nba', teams = [] }) {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [sportName, setSportName] = useState('');

    const GAMES_PER_PAGE = 2;
    const ROTATION_INTERVAL = 5000; // 5 seconds

    const SPORT_NAMES = {
        nba: 'NBA',
        nfl: 'NFL',
        ncaaf: 'NCAA FB',
        ncaab: 'NCAA BB',
        mlb: 'MLB',
        soccer: 'Soccer'
    };

    useEffect(() => {
        console.log('SportsScores: sport changed to:', sport);
        setSportName(SPORT_NAMES[sport] || sport.toUpperCase());
        setCurrentIndex(0);
        setLoading(true); // Reset loading state when sport changes
        fetchScores();
        const interval = setInterval(fetchScores, 2 * 60 * 1000); // Update every 2 minutes
        return () => clearInterval(interval);
    }, [sport, teams]);

    useEffect(() => {
        const maxIndex = Math.max(Math.ceil(games.length / GAMES_PER_PAGE) - 1, 0);
        setCurrentIndex((prevIndex) => Math.min(prevIndex, maxIndex));
    }, [games.length]);

    useEffect(() => {
        if (games.length <= GAMES_PER_PAGE) return;

        const rotationInterval = setInterval(() => {
            setCurrentIndex((prevIndex) => {
                const maxIndex = Math.ceil(games.length / GAMES_PER_PAGE) - 1;
                return prevIndex >= maxIndex ? 0 : prevIndex + 1;
            });
        }, ROTATION_INTERVAL);

        return () => clearInterval(rotationInterval);
    }, [games.length]);

    const fetchScores = async () => {
        console.log(`SportsScores: fetching scores for ${sport}`);
        try {
            const teamsParam = teams && teams.length > 0 ? `?teams=${teams.join(',')}` : '';
            const url = `/api/sports/${sport}/scores${teamsParam}`;
            console.log(`SportsScores: URL =`, url);
            const response = await apiFetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`SportsScores: received data for ${sport}:`, data);

            if (data && data.games) {
                console.log(`SportsScores: setting ${data.games.length} games`);
                setGames(data.games);
            } else {
                console.warn(`No games data for ${sport}`);
                setGames([]);
            }
            setLoading(false);
        } catch (error) {
            console.error(`Error fetching ${sport} scores:`, error);
            setGames([]);
            setLoading(false);
        }
    };

    const getStatusClass = (gameState) => {
        if (gameState === 'live') return 'live';
        if (gameState === 'final') return 'final';
        return 'pre';
    };

    // Determine if a team won
    const isWinner = (game, teamType) => {
        if (game.status !== 'final') return false;
        const teamScore = parseInt(game[teamType].score) || 0;
        const opponentType = teamType === 'away' ? 'home' : 'away';
        const opponentScore = parseInt(game[opponentType].score) || 0;
        return teamScore > opponentScore;
    };

    if (loading) {
        return <div className="sports-scores-container">Loading {sportName} scores...</div>;
    }

    if (games.length === 0) {
        return (
            <div className="sports-scores-container">
                <div className="sports-header">{sportName}</div>
                <div className="no-games">No games today</div>
            </div>
        );
    }

    const startIndex = currentIndex * GAMES_PER_PAGE;
    const visibleGames = games.slice(startIndex, startIndex + GAMES_PER_PAGE);
    const totalPages = Math.ceil(games.length / GAMES_PER_PAGE);

    return (
        <div className="sports-scores-container">
            <div className="sports-header">
                {sportName}
                {totalPages > 1 && (
                    <span className="sports-page-indicator"> ({currentIndex + 1}/{totalPages})</span>
                )}
            </div>
            <div className="sports-games">
                {visibleGames.map(game => (
                    <div key={game.id} className={`sports-game ${getStatusClass(game.status)}`}>
                        {/* Away Team */}
                        <div className={`sports-team away ${isWinner(game, 'away') ? 'winner' : ''}`}>
                            <div className="team-info">
                                <img src={game.away.logo} alt={game.away.team} className="team-logo" />
                                <div className="team-details">
                                    <div className="team-name">
                                        {game.away.rank && game.away.rank <= 25 && <span className="team-rank">#{game.away.rank} </span>}
                                        {game.away.team}
                                    </div>
                                    {game.away.record && <div className="team-record">{game.away.record}</div>}
                                </div>
                            </div>
                            <div className="team-score">{game.away.score}</div>
                        </div>

                        {/* Home Team */}
                        <div className={`sports-team home ${isWinner(game, 'home') ? 'winner' : ''}`}>
                            <div className="team-info">
                                <img src={game.home.logo} alt={game.home.team} className="team-logo" />
                                <div className="team-details">
                                    <div className="team-name">
                                        {game.home.rank && game.home.rank <= 25 && <span className="team-rank">#{game.home.rank} </span>}
                                        {game.home.team}
                                    </div>
                                    {game.home.record && <div className="team-record">{game.home.record}</div>}
                                </div>
                            </div>
                            <div className="team-score">{game.home.score}</div>
                        </div>

                        {/* Game Status */}
                        <div className="game-status">
                            <div className="status-line">{game.statusDetail}</div>
                        </div>

                        {/* Broadcasts */}
                        {game.broadcast && (
                            <div className="game-broadcast">
                                {game.broadcast}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default SportsScores;
