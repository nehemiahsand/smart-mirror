import { useState, useEffect } from 'react';
import './NBAScores.css';

function NBAScores({ teams = [] }) {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    const GAMES_PER_PAGE = 2;
    const ROTATION_INTERVAL = 5000; // 5 seconds

    useEffect(() => {
        fetchNBAScores();
        const interval = setInterval(fetchNBAScores, 2 * 60 * 1000); // Update every 2 minutes
        return () => clearInterval(interval);
    }, [teams]);

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

    const fetchNBAScores = async () => {
        try {
            const teamsParam = teams && teams.length > 0 ? `?teams=${teams.join(',')}` : '';
            const response = await fetch(`http://localhost:3001/api/nba/scores${teamsParam}`);
            const data = await response.json();

            if (data.games) {
                setGames(data.games);
            }
            setLoading(false);
        } catch (error) {
            console.error('Error fetching NBA scores:', error);
            setLoading(false);
        }
    };

    const getStatusClass = (gameState) => {
        if (gameState === 'live') return 'live';
        if (gameState === 'final') return 'final';
        return 'pre';
    };

    if (loading) {
        return <div className="nba-scores-container">Loading NBA scores...</div>;
    }

    if (games.length === 0) {
        return (
            <div className="nba-scores-container">
                <div className="nba-header">NBA</div>
                <div className="no-games">No games today</div>
            </div>
        );
    }

    const startIndex = currentIndex * GAMES_PER_PAGE;
    const visibleGames = games.slice(startIndex, startIndex + GAMES_PER_PAGE);
    const totalPages = Math.ceil(games.length / GAMES_PER_PAGE);

    return (
        <div className="nba-scores-container">
            <div className="nba-header">
                NBA
                {totalPages > 1 && (
                    <span className="nba-page-indicator"> ({currentIndex + 1}/{totalPages})</span>
                )}
            </div>
            <div className="nba-games">
                {visibleGames.map(game => (
                    <div key={game.id} className={`nba-game ${getStatusClass(game.gameState)}`}>
                        {/* Away Team */}
                        <div className={`nba-team away ${game.isWinner.away ? 'winner' : ''}`}>
                            <div className="team-info">
                                <img src={game.awayTeam.logo} alt={game.awayTeam.abbrev} className="team-logo" />
                                <div className="team-details">
                                    <div className="team-name">{game.awayTeam.abbrev}</div>
                                    <div className="team-record">{game.awayTeam.record}</div>
                                </div>
                            </div>
                            <div className="team-score">{game.awayTeam.score}</div>
                        </div>

                        {/* Home Team */}
                        <div className={`nba-team home ${game.isWinner.home ? 'winner' : ''}`}>
                            <div className="team-info">
                                <img src={game.homeTeam.logo} alt={game.homeTeam.abbrev} className="team-logo" />
                                <div className="team-details">
                                    <div className="team-name">{game.homeTeam.abbrev}</div>
                                    <div className="team-record">{game.homeTeam.record}</div>
                                </div>
                            </div>
                            <div className="team-score">{game.homeTeam.score}</div>
                        </div>

                        {/* Game Status */}
                        <div className="game-status">
                            {game.status.map((s, idx) => (
                                <div key={idx} className="status-line">{s}</div>
                            ))}
                        </div>

                        {/* Broadcasts */}
                        {game.broadcasts.length > 0 && (
                            <div className="game-broadcast">
                                {game.broadcasts.slice(0, 2).join(', ')}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default NBAScores;
