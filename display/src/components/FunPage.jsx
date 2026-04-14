import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import TimeDateWidget from '../widgets/TimeDate';
import { apiFetch, getApiUrl } from '../api/apiClient';
import './FunPage.css';

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

function SunWidget({ widget }) {
    if (!widget) {
        return (
            <div className="fun-panel">
                <div className="fun-panel-title">Sun</div>
                <div className="fun-widget-empty">Sun data unavailable</div>
            </div>
        );
    }

    return (
        <div className="fun-panel fun-panel-sun">
            <div className="fun-panel-title">Sun</div>
            <div className="fun-moon-widget">
                <div className="fun-moon-emoji" aria-hidden="true">{widget.emoji || '☀️'}</div>
                <div className="fun-moon-copy">
                    <div className="fun-moon-phase">{widget.statusName || 'Daylight'}</div>
                    <div className="fun-moon-meta">Sunrise: {widget.sunriseTime || '--'}</div>
                    <div className="fun-moon-meta">Sunset: {widget.sunsetTime || '--'}</div>
                    <div className="fun-moon-meta">{widget.daylightDuration || '--'} hours of daylight</div>
                </div>
            </div>
        </div>
    );
}

SunWidget.propTypes = {
    widget: PropTypes.shape({
        emoji: PropTypes.string,
        statusName: PropTypes.string,
        sunriseTime: PropTypes.string,
        sunsetTime: PropTypes.string,
        daylightDuration: PropTypes.string
    })
};

function MoonWidget({ widget }) {
    if (!widget) {
        return (
            <div className="fun-panel">
                <div className="fun-panel-title">Moon</div>
                <div className="fun-widget-empty">Moon data unavailable</div>
            </div>
        );
    }

    return (
        <div className="fun-panel fun-panel-moon">
            <div className="fun-panel-title">Moon</div>
            <div className="fun-moon-widget">
                <div className="fun-moon-emoji" aria-hidden="true">{widget.phaseEmoji || '🌙'}</div>
                <div className="fun-moon-copy">
                    <div className="fun-moon-phase">{widget.phaseName || 'Moon phase'}</div>
                    <div className="fun-moon-meta">{widget.illuminationPercent ?? '--'}% illuminated</div>
                    <div className="fun-moon-meta">Age {widget.ageDays ?? '--'} days</div>
                    <div className="fun-moon-meta">Full moon {widget.nextFullLabel || 'soon'}</div>
                </div>
            </div>
        </div>
    );
}

MoonWidget.propTypes = {
    widget: PropTypes.shape({
        phaseEmoji: PropTypes.string,
        phaseName: PropTypes.string,
        illuminationPercent: PropTypes.number,
        ageDays: PropTypes.number,
        nextFullLabel: PropTypes.string
    })
};

function BibleClockWidget({ widget }) {
    const status = widget?.status || 'error';
    const message = widget?.message || 'Bible clock unavailable';

    const renderReference = (text) => {
        const parts = text.split(/(\d+:\d+)/);
        return parts.map((part, i) =>
            /(\d+:\d+)/.test(part) ? (
                <strong key={i} className="fun-reference-numbers">{part}</strong>
            ) : (
                part
            )
        );
    };

    return (
        <div className="fun-panel fun-panel-verse">
            <div className="fun-panel-header">
                <div className="fun-panel-title">Bible Clock</div>
            </div>

            <div className="fun-verse-reference">{renderReference(message)}</div>

            {status === 'ready' && (
                <div className="fun-verse-text">“{widget.verseText}”</div>
            )}

            {status !== 'ready' && (
                <div className="fun-verse-text fun-verse-text-muted">{widget?.detail || 'Try again later.'}</div>
            )}

            <div className="fun-panel-footer">
                <span>{widget?.detail || 'English Standard Version'}</span>
                {widget?.stale && <span className="fun-stale-pill">Cached</span>}
            </div>
        </div>
    );
}

BibleClockWidget.propTypes = {
    widget: PropTypes.shape({
        status: PropTypes.string,
        timeLabel: PropTypes.string,
        message: PropTypes.string,
        verseText: PropTypes.string,
        detail: PropTypes.string,
        stale: PropTypes.bool
    })
};

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

function BoxScoreInline({ boxScore, game, clipLabel }) {
    if (!boxScore?.team) return null;

    const { players, totals, labels } = boxScore.team;
    if (!players || players.length === 0) return null;

    const displayCols = ['min', 'pts', 'reb', 'ast', 'stl', 'blk', 'fg', '3pt', 'ft', '+/-'];
    const colLabels = { min: 'MIN', pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK', fg: 'FG', '3pt': '3PT', ft: 'FT', '+/-': '+/-' };
    const activeCols = displayCols.filter((c) => labels.includes(c));

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
                        {players.map((p, idx) => (
                            <tr key={idx} className={p.starter ? 'fun-boxscore-starter' : ''}>
                                <td className="fun-boxscore-player-col">
                                    <span className="fun-boxscore-player-name">{p.name}</span>
                                    {p.position && <span className="fun-boxscore-player-pos">{p.position}</span>}
                                </td>
                                {activeCols.map((col) => (
                                    <td key={col}>{p[col] ?? '--'}</td>
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

function VideoUnavailablePanel({ videoFeed }) {
    const query = videoFeed?.query || 'Stephen Curry highlights';
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
        rotationSeconds: PropTypes.number,
        selectedClipIndex: PropTypes.number,
        items: PropTypes.arrayOf(PropTypes.shape({
            videoId: PropTypes.string,
            embedUrl: PropTypes.string,
            title: PropTypes.string,
            channelTitle: PropTypes.string,
            publishedAt: PropTypes.string
        }))
    })
};

function FunContent({ items, loading, videoFeed }) {
    if (loading) {
        return (
            <div className="fun-comic-frame fun-empty-state">
                <div className="fun-empty-title">Loading fun content...</div>
            </div>
        );
    }

    if (videoFeed) {
        if (videoFeed.unavailable) {
            return <VideoUnavailablePanel videoFeed={videoFeed} />;
        }
        return <YouTubeVideoPanel videoFeed={videoFeed} />;
    }

    if (!items || items.length === 0 || items[0].unavailable) {
        return (
            <div className="fun-comic-frame fun-empty-state">
                <div className="fun-empty-title">Fun content unavailable</div>
                <div className="fun-empty-message">{items?.[0]?.message || 'Try again later.'}</div>
            </div>
        );
    }

    const firstItem = items[0];
    if (firstItem.itemType === 'comic') {
        const dates = items.map(i => i.date || 'Today').join(' & ');
        const anyStale = items.some(i => i.stale);

        return (
            <div className="fun-comic-frame">
                <div className="fun-comic-header">
                    <span className="fun-item-title">{firstItem.title}</span>
                </div>

                <div className="fun-comic-body stack-images">
                    {items.map(item => (
                        <img
                            key={item.date}
                            src={`${getApiUrl()}${item.imageUrl}`}
                            alt={item.title || 'Fun content'}
                            className="fun-comic-image"
                            loading="eager"
                        />
                    ))}
                </div>

                <div className="fun-comic-footer">
                    <span>{dates}</span>
                    {anyStale && <span className="fun-stale-pill">Cached</span>}
                </div>
            </div>
        );
    }

    return (
        <div className="fun-empty-state">
            <div className="fun-empty-title">Unsupported fun item</div>
        </div>
    );
}

export default function FunPage({ pageData, settings }) {
    const [items, setItems] = useState(null);
    const [videoFeed, setVideoFeed] = useState(null);
    const [widgets, setWidgets] = useState({});
    const [loading, setLoading] = useState(true);

    const applyFunData = (data) => {
        setItems(data.items || (data.item ? [data.item] : null));
        setVideoFeed(data.videoFeed || null);
        setWidgets(data.widgets || {});
    };

    useEffect(() => {
        let mounted = true;
        let prefetchTimeoutId;
        let swapTimeoutId;
        let pendingData = null;

        const doSwap = () => {
            if (!mounted) return;
            if (pendingData) {
                applyFunData(pendingData);
                pendingData = null;
            }
            schedulePrefetch();
        };

        const doPrefetch = async () => {
            try {
                // Target 10 seconds into the future to ensure we request the next minute's data
                const targetDateMs = Date.now() + 10000;
                const response = await apiFetch(`/api/console/page/fun?targetDate=${targetDateMs}`);
                const data = await response.json();

                if (mounted) {
                    pendingData = data;
                }
            } catch (error) {
                console.error('Failed to pre-fetch fun content:', error);
            } finally {
                if (mounted) {
                    // Schedule the swap exactly at the top of the minute
                    const now = new Date();
                    const msUntilNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
                    // Add a tiny 10ms buffer to align perfectly with the UI clock rollout
                    swapTimeoutId = setTimeout(doSwap, msUntilNextMinute + 10);
                }
            }
        };

        const schedulePrefetch = () => {
            const now = new Date();
            const ms = now.getSeconds() * 1000 + now.getMilliseconds();
            // Aim to prefetch 5 seconds before the minute ends
            let delay = 55000 - ms;
            if (delay < 0) {
                delay = 0; // If we're already past 55s, prefetch immediately
            }
            prefetchTimeoutId = setTimeout(doPrefetch, delay);
        };

        const fetchInitial = async () => {
            try {
                const response = await apiFetch('/api/console/page/fun');
                const data = await response.json();
                if (mounted) {
                    applyFunData(data);
                }
            } catch (error) {
                console.error('Failed to fetch fun content:', error);
                if (mounted) {
                    setItems([{
                        unavailable: true,
                        message: 'Unable to load fun content right now.',
                    }]);
                    setVideoFeed(null);
                    setWidgets({});
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                    schedulePrefetch();
                }
            }
        };

        fetchInitial();

        return () => {
            mounted = false;
            if (prefetchTimeoutId) clearTimeout(prefetchTimeoutId);
            if (swapTimeoutId) clearTimeout(swapTimeoutId);
        };
    }, []);

    useEffect(() => {
        if (!videoFeed?.unavailable) {
            return undefined;
        }

        let cancelled = false;
        const retryTimeoutId = setTimeout(async () => {
            try {
                const response = await apiFetch('/api/console/page/fun');
                const data = await response.json();
                if (!cancelled) {
                    applyFunData(data);
                }
            } catch (error) {
                console.error('Failed to retry YouTube highlights:', error);
            }
        }, 30000);

        return () => {
            cancelled = true;
            clearTimeout(retryTimeoutId);
        };
    }, [videoFeed]);

    useEffect(() => {
        if (!pageData) {
            return;
        }

        applyFunData(pageData);
        setLoading(false);
    }, [pageData]);

    const getOrder = (widgetId) => {
        if (!settings?.funWidgetOrder || !Array.isArray(settings.funWidgetOrder)) {
            const defaults = ['timedate', 'sunmoon', 'bibleclock', 'comics'];
            const idx = defaults.indexOf(widgetId);
            return idx === -1 ? 99 : idx;
        }
        const index = settings.funWidgetOrder.indexOf(widgetId);
        return index === -1 ? 99 : index;
    };

    return (
        <div className="mirror fun-page">
            <div className="fun-page-content" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="fun-time-section" style={{ order: getOrder('timedate') }}>
                    <TimeDateWidget />
                </div>

                <div className="fun-widget-row" style={{ order: getOrder('sunmoon') }}>
                    <SunWidget widget={widgets.sun} />
                    <MoonWidget widget={widgets.moon || widgets.left} />
                </div>

                <div style={{ order: getOrder('bibleclock'), width: '100%', maxWidth: '1320px' }}>
                    <BibleClockWidget widget={widgets.right} />
                </div>

                <div className="fun-comic-section" style={{ order: getOrder('comics') }}>
                    <FunContent items={items} loading={loading} videoFeed={videoFeed} />
                </div>
            </div>
        </div>
    );
}

FunPage.propTypes = {
    pageData: PropTypes.shape({
        item: PropTypes.object,
        videoFeed: PropTypes.object,
        widgets: PropTypes.object
    })
};
