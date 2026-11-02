import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import TimeDateWidget from '../widgets/TimeDate';
import { apiFetch } from '../api/apiClient';
import './FunPage.css';
import './SportsPage.css';
import GameTracker from './GameTracker';
import YouTubeEmbed from './YouTubeEmbed';
import FootballBoxScore from './FootballBoxScore';


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
    const resultClass = result === 'W' ? 'fun-game-result-win' : result === 'L' ? 'fun-game-result-loss' : 'fun-game-result-neutral';

    return (
        <div className="fun-game-score-bar">
            <div className="fun-game-team">
                {away.logo && <img src={away.logo} alt={away.abbrev} className="fun-game-team-logo" />}
                <span className="fun-game-team-name">{away.abbrev}</span>
                <span className="fun-game-team-score">{away.score ?? '—'}</span>
            </div>
            <div className="fun-game-center">
                <span className={`fun-game-result ${resultClass}`}>{result || '—'}</span>
                <span className="fun-game-date">{game.dateFormatted}</span>
                <span className="fun-game-location">{isHome ? 'Home' : 'Away'}</span>
            </div>
            <div className="fun-game-team">
                {home.logo && <img src={home.logo} alt={home.abbrev} className="fun-game-team-logo" />}
                <span className="fun-game-team-name">{home.abbrev}</span>
                <span className="fun-game-team-score">{home.score ?? '—'}</span>
            </div>
        </div>
    );
}

GameScoreBar.propTypes = {
    game: PropTypes.object
};

function BoxScoreInline({ boxScore, game, clipLabel }) {
    if (!boxScore?.team) return <p className="fun-empty-message">Box-score statistics are unavailable for this game.</p>;
    if (boxScore.sport === 'football') return <FootballBoxScore boxScore={boxScore} game={game} />;

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

export function YouTubeVideoPanel({ videoFeed }) {
    const items = Array.isArray(videoFeed?.items) ? videoFeed.items : [];
    const selectedClipIndex = Number.isFinite(videoFeed?.selectedClipIndex)
        ? Number(videoFeed.selectedClipIndex)
        : 0;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [retryNonce, setRetryNonce] = useState(0);
    const [frameStatus, setFrameStatus] = useState('loading');
    const [playbackError, setPlaybackError] = useState('');
    const [publisherBlock, setPublisherBlock] = useState(null);
    const failedClips = useRef(new Set());
    const feedIdentity = items.map((item) => item.game?.gameId || item.videoId).join('|');

    useEffect(() => {
        const index = items.length ? ((selectedClipIndex % items.length) + items.length) % items.length : 0;
        setCurrentIndex(index); setRetryNonce(0); setFrameStatus('loading'); setPlaybackError('');
        failedClips.current.clear(); setPublisherBlock(null);
        // Polling the same feed must not restart playback or undo a skipped clip.
    }, [feedIdentity, selectedClipIndex]);

    function playbackFailed({ code, message }) {
        const current = items[currentIndex] || items[0];
        if ([101, 150].includes(code) && current?.game) {
            setPublisherBlock({ gameId: current.game.gameId, message });
            setPlaybackError(message); setFrameStatus('failed');
            return;
        }
        failedClips.current.add((items[currentIndex] || items[0])?.videoId);
        const nextIndex = items.findIndex((item) => item.videoId && !failedClips.current.has(item.videoId));
        if ([2, 5, 100, 101, 150].includes(code) && nextIndex !== -1) {
            setCurrentIndex(nextIndex); setFrameStatus('loading');
            setPlaybackError('Skipping a highlight that YouTube could not play.');
        } else {
            setFrameStatus('failed'); setPlaybackError(message);
        }
    }

    if (items.length === 0) {
        return <VideoUnavailablePanel videoFeed={videoFeed} />;
    }

    const currentItem = items[currentIndex] || items[0];
    const panelKey = `${currentItem.embedUrl || currentItem.videoId}-${retryNonce}`;
    const game = currentItem.game || null;
    const boxScore = game?.boxScore || null;
    const viewMode = videoFeed?.viewMode || 'video';
    const restricted = videoFeed?.playbackMode === 'external' || !!(game && publisherBlock?.gameId === game.gameId);
    const showBoxScore = viewMode === 'boxscore' || restricted && !!game;
    const watchUrl = currentItem.watchUrl || (currentItem.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(currentItem.videoId)}` : null);

    return (
        <div className="fun-panel fun-video-frame">
            <div className="fun-panel-header">
                <div className="fun-panel-title">{videoFeed?.query || 'Highlights'}</div>
                {game && <span className="fun-stale-pill">Game {currentIndex + 1} of {items.length}</span>}
                {videoFeed?.stale && <span className="fun-stale-pill">Cached</span>}
            </div>

            {restricted && <div className="fun-publisher-notice" role="status">
                <p>{videoFeed?.playbackMessage || publisherBlock?.message || 'The publisher restricts embedded playback.'} {game && 'Showing this game’s box score.'}</p>
                {watchUrl && <a className="fun-player-action" href={watchUrl} target="_blank" rel="noopener noreferrer">Open highlights</a>}
            </div>}
            {!showBoxScore && (
                <>
                    <div className="fun-video-embed-shell">
                        <div className="fun-video-embed-frame">
                            {currentItem.videoId ? <YouTubeEmbed key={panelKey} videoId={currentItem.videoId} title={currentItem.title}
                                onPlaying={() => { setFrameStatus('ready'); setPlaybackError(''); }} onFailure={playbackFailed} /> : <div className="fun-recap-no-video"><strong>Highlights unavailable</strong><p>{currentItem.message || 'This channel has not published highlights for this game.'}</p><small>Use Box to view the available game statistics.</small></div>}
                        </div>
                    </div>

                    <div className="fun-video-meta">
                        <div className="fun-video-title">{currentItem.title}</div>
                        <div className="fun-video-subtitle">
                            <span>{currentItem.channelTitle || 'Highlights'}</span>
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

            {!showBoxScore && currentItem.videoId && frameStatus !== 'ready' && <div className="fun-panel-footer" role="status">
                <span>{playbackError || 'Connecting to highlights…'}</span>
                {frameStatus === 'failed' && <button className="fun-player-action" onClick={() => {
                    failedClips.current.clear(); setPlaybackError(''); setFrameStatus('loading'); setRetryNonce((n) => n + 1);
                }}>Retry highlights</button>}
            </div>}
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

export default function SportsPage({ pageData, settings, isActive = false }) {
    const [videoFeed, setVideoFeed] = useState(pageData?.videoFeed || null);
    const [loading, setLoading] = useState(!pageData);
    const [experience, setExperience] = useState(pageData?.experience || null);
    const configuredTeam = settings?.sports?.highlightsTeam || 'gsw';
    const teamRef = useRef(configuredTeam);
    teamRef.current = configuredTeam;
    const awaitingTeam = experience?.preferences?.team && experience.preferences.team !== configuredTeam;

    const applySportsData = (data) => {
        if (data?.experience?.preferences?.team && data.experience.preferences.team !== teamRef.current) return false;
        setVideoFeed(data?.videoFeed || null);
        setExperience(data?.experience || null);
        return true;
    };

    useEffect(() => {
        if (!pageData) {
            return;
        }

        if (applySportsData(pageData)) setLoading(false);
    }, [pageData, configuredTeam]);

    useEffect(() => {
        if (!isActive) return undefined;
        let active = true;
        let pending = false;
        const controller = new AbortController();
        const load = async () => {
            if (pending || document.hidden) return;
            pending = true;
            try {
                const response = await apiFetch('/api/console/page/sports', { signal: controller.signal });
                if (!response.ok) throw new Error('Sports refresh failed');
                const data = await response.json();
                if (active && applySportsData(data)) setLoading(false);
            } catch (_) {
                if (active) setExperience((old) => old?.tracker ? { ...old, tracker: { ...old.tracker, stale: true } } : old);
            } finally { pending = false; }
        };
        load();
        const timer = setInterval(load, 15000);
        document.addEventListener('visibilitychange', load);
        return () => { active = false; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', load); };
    }, [isActive, configuredTeam, settings?.sports?.liveGames]);

    return (
        <div className={`mirror sports-page ${experience?.tracker ? 'sports-page-live' : videoFeed?.viewMode === 'boxscore' ? 'sports-page-boxscore' : ''}`}>
            <div className="sports-page-content">
                {settings?.pageVisibility?.sports?.timedate !== false && <div className="sports-page-time-section" style={{ order: getSectionOrder(settings, 'timedate') }}>
                    <TimeDateWidget format={settings?.display?.clockFormat || '12h'} />
                </div>}

                {settings?.pageVisibility?.sports?.highlights !== false && <div className="sports-page-highlights" style={{ order: getSectionOrder(settings, 'highlights') }}>
                    {awaitingTeam || loading && !videoFeed ? (
                        <div className="fun-comic-frame fun-empty-state">
                            <div className="fun-empty-title">Loading sports content...</div>
                        </div>
                    ) : experience?.tracker ? (
                        <>
                            <GameTracker game={experience.tracker} />
                            {experience.tracker.stale && <p className="tracker-unavailable">Highlights can be selected from Nexus → Mirror → Edit → Sports while updates reconnect.</p>}
                        </>
                    ) : isActive ? (
                        <>
                        {experience?.failures?.length > 0 && <p className="tracker-stale-note">Some live feeds are unavailable. Highlights are shown while game status is unconfirmed.</p>}
                        <YouTubeVideoPanel
                            videoFeed={videoFeed || {
                                unavailable: true,
                                message: 'Unable to load sports content right now.'
                            }}
                        />
                        </>
                    ) : null}
                </div>}
            </div>
        </div>
    );
}

SportsPage.propTypes = {
    pageData: PropTypes.shape({
        videoFeed: PropTypes.object,
        experience: PropTypes.object
    }),
    settings: PropTypes.shape({
        sportsWidgetOrder: PropTypes.array
    }),
    isActive: PropTypes.bool
};
