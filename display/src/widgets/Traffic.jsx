import React, { useState, useEffect, useMemo } from 'react';
import './Traffic.css';

const Traffic = () => {
    const [trafficData, setTrafficData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // Update current time every second
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timeInterval);
    }, []);

    useEffect(() => {
        const fetchTrafficData = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/traffic/commute');
                if (!response.ok) {
                    throw new Error('Failed to fetch traffic data');
                }
                const data = await response.json();
                setTrafficData(data);
                setError(null);
            } catch (err) {
                console.error('Traffic fetch error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTrafficData();

        // Refresh every 5 minutes
        const interval = setInterval(fetchTrafficData, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    const getTrafficIcon = (conditions) => {
        switch (conditions) {
            case 'light':
                return '🟢';
            case 'moderate':
                return '🟡';
            case 'heavy':
                return '🔴';
            default:
                return '🚗';
        }
    };

    const getTrafficColor = (conditions) => {
        switch (conditions) {
            case 'light':
                return '#4ade80';
            case 'moderate':
                return '#fbbf24';
            case 'heavy':
                return '#ef4444';
            default:
                return '#9ca3af';
        }
    };

    // Calculate real-time ETA based on current time + drive duration
    const liveETA = useMemo(() => {
        if (!trafficData?.durationMinutes) {
            return null;
        }

        const eta = new Date(currentTime.getTime() + (trafficData.durationMinutes * 60 * 1000));
        const hours = eta.getHours();
        const minutes = eta.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');

        return `${displayHours}:${displayMinutes} ${ampm}`;
    }, [currentTime, trafficData]);

    if (loading) {
        return (
            <div className="traffic-widget">
                <div className="traffic-loading">Loading traffic data...</div>
            </div>
        );
    }

    if (error || !trafficData) {
        return (
            <div className="traffic-widget">
                <div className="traffic-error">
                    <div className="traffic-error-icon">⚠️</div>
                    <div className="traffic-error-text">
                        {error || 'Traffic data unavailable'}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="traffic-widget">
            <div className="traffic-header">
                <div className="traffic-icon">{getTrafficIcon(trafficData.trafficConditions)}</div>
                <div className="traffic-title">Drive to School</div>
            </div>

            <div className="traffic-main">
                <div className="traffic-duration">
                    <div className="duration-value">{trafficData.durationMinutes}</div>
                    <div className="duration-unit">min</div>
                </div>

                <div className="traffic-details">
                    <div className="traffic-distance">{trafficData.distance}</div>
                    <div
                        className="traffic-conditions"
                        style={{ color: getTrafficColor(trafficData.trafficConditions) }}
                    >
                        {trafficData.trafficConditions.toUpperCase()} TRAFFIC
                    </div>
                </div>
            </div>

            <div className="traffic-eta">
                <div className="eta-label">Arrive by ({currentTime.getSeconds()}s)</div>
                <div className="eta-time">
                    {liveETA || trafficData.etaFormatted || '--:--'}
                </div>
                <div style={{ fontSize: '12px', marginTop: '5px', color: '#888' }}>
                    Debug: {trafficData.durationMinutes}min drive | Live: {liveETA ? 'YES' : 'NO'}
                </div>
            </div>

            {trafficData.stale && (
                <div className="traffic-stale-warning">
                    ⚠️ Using cached data
                </div>
            )}
        </div>
    );
};

export default Traffic;
