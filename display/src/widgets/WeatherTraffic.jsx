import React, { useState, useEffect, useMemo } from 'react';
import { useSharedTime } from '../hooks/useSharedTime';
import PropTypes from 'prop-types';
import './WeatherTraffic.css';
import { apiFetch } from '../api/apiClient';

/**
 * WeatherTrafficWidget - Combined weather, indoor temp, and traffic display
 */
const WeatherTrafficWidget = ({ weatherData, sensorData, className = '' }) => {
    const [trafficData, setTrafficData] = useState(null);
    const [trafficError, setTrafficError] = useState(null);
    const currentTime = useSharedTime();

    useEffect(() => {
        const fetchTrafficData = async () => {
            try {
                const response = await apiFetch('/api/traffic/commute');
                if (!response.ok) {
                    throw new Error('Failed to fetch traffic data');
                }
                const data = await response.json();
                setTrafficData(data);
                setTrafficError(null);
            } catch (err) {
                console.error('Traffic fetch error:', err);
                setTrafficError(err.message);
            }
        };

        fetchTrafficData();
        const interval = setInterval(fetchTrafficData, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Normalize trafficData into an array of commutes. Backend returns either
    // { commutes: [...] } (new) or a single commute object (legacy).
    const commutes = useMemo(() => {
        if (!trafficData) return [];
        if (Array.isArray(trafficData.commutes)) return trafficData.commutes;
        if (trafficData.durationMinutes) return [{ label: 'Destination', ...trafficData }];
        return [];
    }, [trafficData]);

    const formatLiveEta = (minutes) => {
        if (!minutes) return null;
        const eta = new Date(currentTime.getTime() + (minutes * 60 * 1000));
        const hours = eta.getHours();
        const mins = eta.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = mins.toString().padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    const getWeatherIcon = (icon) => {
        const iconMap = {
            '01d': '☀️', '01n': '🌙',
            '02d': '⛅', '02n': '☁️',
            '03d': '☁️', '03n': '☁️',
            '04d': '☁️', '04n': '☁️',
            '09d': '🌧️', '09n': '🌧️',
            '10d': '🌦️', '10n': '🌧️',
            '11d': '⛈️', '11n': '⛈️',
            '13d': '❄️', '13n': '❄️',
            '50d': '🌫️', '50n': '🌫️'
        };
        return iconMap[icon] || '☁️';
    };

    const getTrafficIcon = (conditions) => {
        switch (conditions) {
            case 'light': return '🟢';
            case 'moderate': return '🟡';
            case 'heavy': return '🔴';
            default: return '🚗';
        }
    };

    const tempC = sensorData?.temperatureCelsius || sensorData?.temperature;
    const tempF = sensorData?.temperatureFahrenheit || (tempC ? (tempC * 9 / 5 + 32).toFixed(1) : null);

    return (
        <div className={`widget weathertraffic-widget ${className}`}>
            <div className="weathertraffic-container">
                {/* Outdoor Weather */}
                <div className="wt-section outdoor">
                    <div className="wt-label">Outside</div>
                    {weatherData && !weatherData.error ? (
                        <>
                            <div className="wt-icon">{getWeatherIcon(weatherData.icon)}</div>
                            <div className="wt-temp">{weatherData.temperature}°</div>
                            <div className="wt-highlow">
                                <span className="high">↑ {weatherData.tempMax}°</span>
                                <span className="low">↓ {weatherData.tempMin}°</span>
                            </div>
                            <div className="wt-detail">💧 {weatherData.humidity}%</div>
                        </>
                    ) : (
                        <>
                            <div className="wt-icon">☁️</div>
                            <div className="wt-temp">--°</div>
                        </>
                    )}
                </div>

                {/* Indoor Temperature */}
                <div className="wt-section indoor">
                    <div className="wt-label">Inside</div>
                    {sensorData && !sensorData.error ? (
                        <>
                            <div className="wt-icon">🌡️</div>
                            <div className="wt-temp">{tempF}°F</div>
                            <div className="wt-desc">{tempC}°C</div>
                            <div className="wt-detail">💧 {sensorData.humidity}%</div>
                        </>
                    ) : (
                        <>
                            <div className="wt-icon">🌡️</div>
                            <div className="wt-temp">--°</div>
                        </>
                    )}
                </div>

                {/* Traffic */}
                <div className="wt-section traffic">
                    <div className="wt-label">Commute</div>
                    {commutes.length > 0 && !trafficError ? (
                        <div className="wt-commutes">
                            {commutes.map((commute, idx) => (
                                <div key={`${commute.label}-${idx}`} className="wt-commute-row">
                                    {commute.error || !commute.durationMinutes ? (
                                        <>
                                            <div className="wt-commute-label">{commute.label}</div>
                                            <div className="wt-commute-value">--</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="wt-commute-label">
                                                <span className="wt-commute-icon">{getTrafficIcon(commute.trafficConditions)}</span>
                                                {commute.label}
                                            </div>
                                            <div className="wt-commute-value">
                                                <span className="wt-commute-duration">{commute.durationMinutes} min</span>
                                                <span className="wt-commute-eta">ETA {formatLiveEta(commute.durationMinutes) || commute.etaFormatted}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="wt-icon">🚗</div>
                            <div className="wt-temp">--</div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

WeatherTrafficWidget.propTypes = {
    weatherData: PropTypes.shape({
        city: PropTypes.string,
        temperature: PropTypes.number,
        description: PropTypes.string,
        icon: PropTypes.string,
        humidity: PropTypes.number,
        error: PropTypes.string
    }),
    sensorData: PropTypes.shape({
        temperatureCelsius: PropTypes.number,
        temperatureFahrenheit: PropTypes.number,
        temperature: PropTypes.number,
        humidity: PropTypes.number,
        error: PropTypes.string
    }),
    className: PropTypes.string
};

export default WeatherTrafficWidget;
