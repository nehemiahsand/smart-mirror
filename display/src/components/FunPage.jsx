import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import TimeDateWidget from '../widgets/TimeDate';
import { apiFetch, getApiUrl } from '../apiClient';
import './FunPage.css';

function FunContent({ item, loading }) {
    if (loading) {
        return (
            <div className="fun-empty-state">
                <div className="fun-empty-title">Loading fun content...</div>
            </div>
        );
    }

    if (!item || item.unavailable) {
        return (
            <div className="fun-empty-state">
                <div className="fun-empty-title">Fun content unavailable</div>
                <div className="fun-empty-message">{item?.message || 'Try again later.'}</div>
            </div>
        );
    }

    if (item.itemType === 'comic') {
        return (
            <div className="fun-card">
                <div className="fun-card-header">
                    <span className="fun-item-pill">Daily Fun</span>
                    <span className="fun-item-title">{item.title}</span>
                </div>

                <div className="fun-card-body">
                    <img
                        src={`${getApiUrl()}${item.imageUrl}`}
                        alt={item.title || 'Fun content'}
                        className="fun-comic-image"
                        loading="eager"
                    />
                </div>

                <div className="fun-card-footer">
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchFunContent = async () => {
            try {
                const response = await apiFetch('/api/console/page/fun');
                const data = await response.json();
                if (mounted) {
                    setItem(data.item || null);
                }
            } catch (error) {
                console.error('Failed to fetch fun content:', error);
                if (mounted) {
                    setItem({
                        unavailable: true,
                        message: 'Unable to load fun content right now.',
                    });
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchFunContent();
        const interval = setInterval(fetchFunContent, 10 * 60 * 1000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (pageData?.item) {
            setItem(pageData.item);
            setLoading(false);
        }
    }, [pageData]);

    return (
        <div className="mirror fun-page">
            <div className="fun-page-content">
                <div className="fun-time-section">
                    <TimeDateWidget />
                </div>
                <div className="fun-content-section">
                    <FunContent item={item} loading={loading} />
                </div>
            </div>
        </div>
    );
}

FunPage.propTypes = {
    pageData: PropTypes.shape({
        item: PropTypes.object
    })
};
