import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import TimeDateWidget from '../widgets/TimeDate';
import { apiFetch } from '../api/apiClient';
import './FunPage.css';
import './SportsPage.css';

const VIDEO_LOAD_TIMEOUT_MS = 15000;

function formatPublishedAt(value) {
    if (!value) {
        return 'Recently uploaded';
    }

    const publishedDate = new Date(value);
    if (Number.isNaN(publishedDate.getTime())) {
        return 'Recently uploaded';
    }

    return publishedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function GameScoreBar({ game }) {
    if (!game) return null;
    const { home, away, result, homeAway } = game;
    const isHome = homeAway === 'home';
    const resultClass = result === 'W' ? 'fun-game-result-win' : 'fun-game-result-loss';

    return (
        <div className="fun-game-score-bar">
            <div className="fun-game-team">
                {away.logo && <img src={away.logo} alt={away.abbrev} className="fun-game-team-logo" />}
                <span className="fun-game-team-name">{away.abbrev}</span>
                <span className="fun-game-team-score">{away.score}</span>
            </div>
            <div className="fun-game-center">
                <span className={`fun-game-result ${resultClass}`}>{result}</span>
                <span className="fun-game-date">{game.dateFormatted}</span>
                <span className="fun-game-location">{isHome ? 'Home' : 'Away'}</span>
            </div>
            <div className="fun-game-team">
                {home.logo && <img src={home.logo} alt={home.abbrev} className="fun-game-team-logo" />}
                <span className="fun-game-team-name">{home.abbrev}</span>
                <span className="fun-game-team-score">{home.score}</span>
            </div>
        </div>
    );
}

GameScoreBar.propTypes = {
    game: PropTypes.object
};

function BoxScoreInline({ boxScore, game, clipLabel }) {
    if (!boxScore?.team) return null;

    const { players, totals, labels } = boxScore.team;
    if (!players || players.length === 0) return null;

    const displayCols = ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'fg', '3pt', 'ft', '+/-'];
    const colLabels = { min: 'MIN', pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', fg: 'FG', '3pt': '3PT', ft: 'FT', '+/-': '+/-' };
    const activeCols = displayCols.filter((col) => labels.includes(col));

    const teamAbbrev = game?.homeAway === 'home' ? game.home?.abbrev : game.away?.abbrev;
    const oppAbbrev = game?.homeAway === 'home' ? game.away?.abbrev : game.home?.abbrev;

    return (
        <div className="fun-boxscore-inline">
            <div className="fun-boxscore-inline-header">
                <span className="fun-boxscore-team-label">{teamAbbrev || 'Warriors'} Box Score</span>
                {clipLabel && <span className="fun-video-subtitle">{clipLabel}</span>}
            </div>
            <div className="fun-boxscore-scroll">
                <table className="fun-boxscore-table">
                    <thead>
                        <tr>
                            <th className="fun-boxscore-player-col">Player</th>
                            {activeCols.map((col) => (
                                <th key={col}>{colLabels[col] || col.toUpperCase()}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {players.map((player, idx) => (
                            <tr key={idx} className={player.starter ? 'fun-boxscore-starter' : ''}>
                                <td className="fun-boxscore-player-col">
                                    <span className="fun-boxscore-player-name">{player.name}</span>
                                    {player.position && <span className="fun-boxscore-player-pos">{player.position}</span>}
                                </td>
                                {activeCols.map((col) => (
                                    <td key={col}>{player[col] ?? '--'}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                    {totals && (
                        <tfoot>
                            <tr>
                                <td className="fun-boxscore-player-col"><strong>TOTALS</strong></td>
                                {activeCols.map((col) => (
                                    <td key={col}><strong>{totals[col] ?? '--'}</strong></td>
                                ))}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {boxScore.opponent?.totals && (
                <div className="fun-boxscore-opponent-line">
                    {oppAbbrev || 'OPP'}:
                    {' '}{boxScore.opponent.totals.pts ?? '--'} PTS
                    {' · '}{boxScore.opponent.totals.reb ?? '--'} REB
                    {' · '}{boxScore.opponent.totals.ast ?? '--'} AST
                </div>
            )}
        </div>
    );
}

BoxScoreInline.propTypes = {
    boxScore: PropTypes.object,
    game: PropTypes.object,
    clipLabel: PropTypes.string
};

function VideoUnavailablePanel({ videoFeed }) {
    const query = videoFeed?.query || 'Golden State Warriors highlights';
    const message = videoFeed?.message || 'Waiting for the next successful video refresh.';

    return (
        <div className="fun-panel fun-video-frame">
            <div className="fun-panel-header">
                <div className="fun-panel-title">{query}</div>
                <span className="fun-stale-pill">Retrying</span>
            </div>

            <div className="fun-video-unavailable">
                <div className="fun-empty-title">Highlights unavailable</div>
                <div className="fun-empty-message">{message}</div>
            </div>
        </div>
    );
}

VideoUnavailablePanel.propTypes = {
    videoFeed: PropTypes.shape({
        query: PropTypes.string,
        message: PropTypes.string
    })
};

function YouTubeVideoPanel({ videoFeed }) {
    const items = Array.isArray(videoFeed?.items) ? videoFeed.items : [];
    const selectedClipIndex = Number.isFinite(videoFeed?.selectedClipIndex)
        ? Number(videoFeed.selectedClipIndex)
        : 0;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [retryNonce, setRetryNonce] = useState(0);
    const [frameStatus, setFrameStatus] = useState('loading');
    const hasLoadedRef = useRef(false);

    useEffect(() => {
        setCurrentIndex(0);
        setRetryNonce(0);
        setFrameStatus('loading');
    }, [videoFeed?.date, videoFeed?.fetchedAt, items.length]);

    useEffect(() => {
        if (items.length === 0) {
            return undefined;
        }
        const normalizedIndex = ((selectedClipIndex % items.length) + items.length) % items.length;
        setCurrentIndex(normalizedIndex);
        setRetryNonce(0);
        return undefined;
    }, [items.length, selectedClipIndex]);

    useEffect(() => {
        if (items.length === 0) {
            return undefined;
        }

        hasLoadedRef.current = false;
        setFrameStatus('loading');

        const timerId = setTimeout(() => {
            if (!hasLoadedRef.current) {
                setFrameStatus('retrying');
                setRetryNonce((value) => value + 1);
            }
        }, VIDEO_LOAD_TIMEOUT_MS);

        return () => clearTimeout(timerId);
    }, [currentIndex, retryNonce, items.length]);

    if (items.length === 0) {
        return <VideoUnavailablePanel videoFeed={videoFeed} />;
    }

    const currentItem = items[currentIndex] || items[0];
    const panelKey = `${currentItem.videoId}-${retryNonce}`;
    const game = currentItem.game || null;
    const boxScore = game?.boxScore || null;
    const viewMode = videoFeed?.viewMode || 'video';
    const showBoxScore = viewMode === 'boxscore' && boxScore;

    return (
        <div className="fun-panel fun-video-frame">
            <div className="fun-panel-header">
                <div className="fun-panel-title">{videoFeed?.query || 'Highlights'}</div>
                {videoFeed?.stale && <span className="fun-stale-pill">Cached</span>}
            </div>

            {!showBoxScore && (
                <>
                    <div className="fun-video-embed-shell">
                        <div className="fun-video-embed-frame">
                            <iframe
                                key={panelKey}
                                src={currentItem.embedUrl}
                                title={currentItem.title || 'Highlights'}
                                className="fun-video-embed"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                loading="eager"
                                onLoad={() => {
                                    hasLoadedRef.current = true;
                                    setFrameStatus('ready');
                                }}
                            />
                        </div>
                    </div>

                    <div className="fun-video-meta">
                        <div className="fun-video-title">{currentItem.title}</div>
                        <div className="fun-video-subtitle">
                            <span>{currentItem.channelTitle || 'YouTube'}</span>
                            <span>{formatPublishedAt(currentItem.publishedAt)}</span>
                            <span>Clip {currentIndex + 1} of {items.length}</span>
                        </div>
                    </div>
                </>
            )}

            {showBoxScore && (
                <BoxScoreInline boxScore={boxScore} game={game} clipLabel={`Game ${currentIndex + 1} of ${items.length}`} />
            )}

            {game && <GameScoreBar game={game} />}

            {!showBoxScore && frameStatus === 'retrying' && (
                <div className="fun-panel-footer">
                    <span className="fun-stale-pill">Retrying embed</span>
                </div>
            )}
        </div>
    );
}

YouTubeVideoPanel.propTypes = {
    videoFeed: PropTypes.shape({
        date: PropTypes.string,
        fetchedAt: PropTypes.string,
        query: PropTypes.string,
        stale: PropTypes.bool,
        selectedClipIndex: PropTypes.number,
        viewMode: PropTypes.string,
        items: PropTypes.arrayOf(PropTypes.shape({
            videoId: PropTypes.string,
            embedUrl: PropTypes.string,
            title: PropTypes.string,
            channelTitle: PropTypes.string,
            publishedAt: PropTypes.string
        }))
    })
};

function getSectionOrder(settings, sectionId) {
    const order = Array.isArray(settings?.sportsWidgetOrder) ? settings.sportsWidgetOrder : ['timedate', 'highlights'];
    const index = order.indexOf(sectionId);
    return index === -1 ? 999 : index;
}

export default function SportsPage({ pageData, settings }) {
    const [videoFeed, setVideoFeed] = useState(pageData?.videoFeed || null);
    const [loading, setLoading] = useState(!pageData);

    const applySportsData = (data) => {
        setVideoFeed(data?.videoFeed || null);
    };

    useEffect(() => {
        if (!pageData) {
            return;
        }

        applySportsData(pageData);
        setLoading(false);
    }, [pageData]);

    useEffect(() => {
        let mounted = true;

        const fetchSportsPage = async () => {
            try {
                const response = await apiFetch('/api/console/page/sports');
                const data = await response.json();
                if (mounted) {
                    applySportsData(data);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Failed to fetch sports page data:', error);
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchSportsPage();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!videoFeed?.unavailable) {
            return undefined;
        }

        let cancelled = false;
        const retryTimeoutId = setTimeout(async () => {
            try {
                const response = await apiFetch('/api/console/page/sports');
                const data = await response.json();
                if (!cancelled) {
                    applySportsData(data);
                }
            } catch (error) {
                console.error('Failed to retry Warriors highlights:', error);
            }
        }, 30000);

        return () => {
            cancelled = true;
            clearTimeout(retryTimeoutId);
        };
    }, [videoFeed]);

    return (
        <div className="mirror sports-page">
            <div className="sports-page-content">
                <div className="sports-page-time-section" style={{ order: getSectionOrder(settings, 'timedate') }}>
                    <TimeDateWidget />
                </div>

                <div className="sports-page-highlights" style={{ order: getSectionOrder(settings, 'highlights') }}>
                    {loading && !videoFeed ? (
                        <div className="fun-comic-frame fun-empty-state">
                            <div className="fun-empty-title">Loading sports content...</div>
                        </div>
                    ) : (
                        <YouTubeVideoPanel
                            videoFeed={videoFeed || {
                                unavailable: true,
                                message: 'Unable to load sports content right now.'
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

SportsPage.propTypes = {
    pageData: PropTypes.shape({
        videoFeed: PropTypes.object
    }),
    settings: PropTypes.shape({
        sportsWidgetOrder: PropTypes.array
    })
};
