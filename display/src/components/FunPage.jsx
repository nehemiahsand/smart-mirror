import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import TimeDateWidget from '../widgets/TimeDate';
import { apiFetch, getApiUrl } from '../apiClient';
import './FunPage.css';

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

function FunContent({ items, loading }) {
    if (loading) {
        return (
            <div className="fun-comic-frame fun-empty-state">
                <div className="fun-empty-title">Loading fun content...</div>
            </div>
        );
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
    const [widgets, setWidgets] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        let prefetchTimeoutId;
        let swapTimeoutId;
        let pendingData = null;

        const doSwap = () => {
            if (!mounted) return;
            if (pendingData) {
                setItems(pendingData.items || (pendingData.item ? [pendingData.item] : null));
                setWidgets(pendingData.widgets || {});
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
                    setItems(data.items || (data.item ? [data.item] : null));
                    setWidgets(data.widgets || {});
                }
            } catch (error) {
                console.error('Failed to fetch fun content:', error);
                if (mounted) {
                    setItems([{
                        unavailable: true,
                        message: 'Unable to load fun content right now.',
                    }]);
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
        if (!pageData) {
            return;
        }

        if (pageData.items) {
            setItems(pageData.items);
        } else if (pageData.item) {
            setItems([pageData.item]);
        }

        if (pageData.widgets) {
            setWidgets(pageData.widgets);
        }

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
                    <FunContent items={items} loading={loading} />
                </div>
            </div>
        </div>
    );
}

FunPage.propTypes = {
    pageData: PropTypes.shape({
        item: PropTypes.object,
        widgets: PropTypes.object
    })
};
