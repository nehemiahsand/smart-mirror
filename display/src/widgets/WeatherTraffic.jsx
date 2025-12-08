import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import './WeatherTraffic.css';

/**
 * WeatherTrafficWidget - Combined weather, indoor temp, and traffic display
 */
const WeatherTrafficWidget = ({ weatherData, sensorData, className = '' }) => {
    const [trafficData, setTrafficData] = useState(null);
    const [trafficError, setTrafficError] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // Update current time every second for live ETA
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
                setTrafficError(null);
            } catch (err) {
                console.error('Traffic fetch error:', err);
                setTrafficError(err.message);
            }
        };

        fetchTrafficData();
        const interval = setInterval(fetchTrafficData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

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

    // Calculate live ETA by adding drive duration to current time
    const liveETA = useMemo(() => {
        if (!trafficData?.durationMinutes) return null;

        const eta = new Date(currentTime.getTime() + (trafficData.durationMinutes * 60 * 1000));
        const hours = eta.getHours();
        const minutes = eta.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes.toString().padStart(2, '0');

        return `${displayHours}:${displayMinutes} ${ampm}`;
    }, [currentTime, trafficData]);

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
                            <div className="wt-desc">{weatherData.description}</div>
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
                    <div className="wt-label">To School</div>
                    {trafficData && !trafficError ? (
                        <>
                            <div className="wt-icon">{getTrafficIcon(trafficData.trafficConditions)}</div>
                            <div className="wt-temp">{trafficData.durationMinutes} min</div>
                            <div className="wt-desc">{trafficData.distance}</div>
                            <div className="wt-detail">ETA {liveETA || trafficData.etaFormatted}</div>
                        </>
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
