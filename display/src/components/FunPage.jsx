import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import TimeDateWidget from '../widgets/TimeDate';
import { apiFetch, getApiUrl } from '../apiClient';
import './FunPage.css';

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

    return (
        <div className="fun-panel fun-panel-verse">
            <div className="fun-panel-header">
                <div className="fun-panel-title">Bible Clock</div>
                <div className="fun-verse-time">{widget?.timeLabel || '--:--'}</div>
            </div>

            <div className="fun-verse-reference">{widget?.message || 'Bible clock unavailable'}</div>

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

function FunContent({ item, loading }) {
    if (loading) {
        return (
            <div className="fun-comic-frame fun-empty-state">
                <div className="fun-empty-title">Loading fun content...</div>
            </div>
        );
    }

    if (!item || item.unavailable) {
        return (
            <div className="fun-comic-frame fun-empty-state">
                <div className="fun-empty-title">Fun content unavailable</div>
                <div className="fun-empty-message">{item?.message || 'Try again later.'}</div>
            </div>
        );
    }

    if (item.itemType === 'comic') {
        return (
            <div className="fun-comic-frame">
                <div className="fun-comic-header">
                    <span className="fun-item-pill">Daily Fun</span>
                    <span className="fun-item-title">{item.title}</span>
                </div>

                <div className="fun-comic-body">
                    <img
                        src={`${getApiUrl()}${item.imageUrl}`}
                        alt={item.title || 'Fun content'}
                        className="fun-comic-image"
                        loading="eager"
                    />
                </div>

                <div className="fun-comic-footer">
                    <span>{item.date || 'Today'}</span>
                    {item.stale && <span className="fun-stale-pill">Cached</span>}
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

export default function FunPage({ pageData }) {
    const [item, setItem] = useState(null);
    const [widgets, setWidgets] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchFunContent = async () => {
            try {
                const response = await apiFetch('/api/console/page/fun');
                const data = await response.json();
                if (mounted) {
                    setItem(data.item || null);
                    setWidgets(data.widgets || {});
                }
            } catch (error) {
                console.error('Failed to fetch fun content:', error);
                if (mounted) {
                    setItem({
                        unavailable: true,
                        message: 'Unable to load fun content right now.',
                    });
                    setWidgets({});
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchFunContent();
        const interval = setInterval(fetchFunContent, 60 * 1000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!pageData) {
            return;
        }

        if (pageData.item) {
            setItem(pageData.item);
        }

        if (pageData.widgets) {
            setWidgets(pageData.widgets);
        }

        setLoading(false);
    }, [pageData]);

    return (
        <div className="mirror fun-page">
            <div className="fun-page-content">
                <div className="fun-time-section">
                    <TimeDateWidget />
                </div>
                <div className="fun-content-section">
                    <div className="fun-widget-row">
                        <MoonWidget widget={widgets.left} />
                        <BibleClockWidget widget={widgets.right} />
                    </div>
                    <div className="fun-comic-section">
                        <FunContent item={item} loading={loading} />
                    </div>
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
