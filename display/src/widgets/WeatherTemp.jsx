import React from 'react';
import PropTypes from 'prop-types';
import './WeatherTemp.css';

/**
 * WeatherTempWidget - Combined weather and indoor temperature display
 * @param {Object} weatherData - Weather data from WebSocket/API
 * @param {Object} sensorData - Sensor data from WebSocket
 * @param {string} className - Additional CSS classes
 */
const WeatherTempWidget = ({ weatherData, sensorData, className = '' }) => {
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

    const getSunTime = () => {
        if (!weatherData?.sunrise || !weatherData?.sunset) {
            return { label: '', time: '', icon: '' };
        }

        const now = Date.now() / 1000; // Current time in Unix timestamp (seconds)
        const sunrise = weatherData.sunrise;
        const sunset = weatherData.sunset;

        // If current time is before sunrise, show sunrise
        if (now < sunrise) {
            const sunriseDate = new Date(sunrise * 1000);
            const hours = sunriseDate.getHours();
            const minutes = sunriseDate.getMinutes();
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            return {
                label: 'Sunrise',
                time: `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`,
                icon: '🌄'
            };
        }
        // If current time is between sunrise and sunset, show sunset
        else if (now < sunset) {
            const sunsetDate = new Date(sunset * 1000);
            const hours = sunsetDate.getHours();
            const minutes = sunsetDate.getMinutes();
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            return {
                label: 'Sunset',
                time: `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`,
                icon: '🌅'
            };
        }
        // If current time is after sunset, show tomorrow's sunrise
        else {
            const sunriseDate = new Date(sunrise * 1000);
            // Add 24 hours for tomorrow
            sunriseDate.setDate(sunriseDate.getDate() + 1);
            const hours = sunriseDate.getHours();
            const minutes = sunriseDate.getMinutes();
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            return {
                label: 'Sunrise',
                time: `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`,
                icon: '🌄'
            };
        }
    };

    const sunTime = getSunTime();

    // Handle sensor data formats
    const tempC = sensorData?.temperatureCelsius || sensorData?.temperature;
    const tempF = sensorData?.temperatureFahrenheit || (tempC ? (tempC * 9 / 5 + 32).toFixed(1) : null);

    return (
        <div className={`widget weathertemp-widget ${className}`}>
            <div className="weathertemp-container">
                {/* Outdoor Weather */}
                <div className="weathertemp-section outdoor">
                    <div className="section-label">Outside</div>
                    {weatherData && !weatherData.error ? (
                        <>
                            <div className="section-icon">{getWeatherIcon(weatherData.icon)}</div>
                            <div className="section-temp">{weatherData.temperature}°</div>
                            <div className="section-highlow">
                                <span className="high">H: {weatherData.tempMax}°</span>
                                <span className="low">L: {weatherData.tempMin}°</span>
                            </div>
                            <div className="section-desc">{weatherData.description}</div>
                            <div className="section-details">
                                <span>💧 {weatherData.humidity}%</span>
                                {sunTime.time && <span>{sunTime.icon} {sunTime.time}</span>}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="section-icon">☁️</div>
                            <div className="section-temp">--°</div>
                            <div className="section-desc">Loading...</div>
                        </>
                    )}
                </div>

                {/* Indoor Temperature */}
                <div className="weathertemp-section indoor">
                    <div className="section-label">Inside</div>
                    {sensorData && !sensorData.error ? (
                        <>
                            <div className="section-icon">🌡️</div>
                            <div className="section-temp">{tempF}°F</div>
                            <div className="section-desc">{tempC}°C</div>
                            <div className="section-details">
                                <span>💧 {sensorData.humidity}%</span>
                                <span>Humidity</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="section-icon">🌡️</div>
                            <div className="section-temp">--°</div>
                            <div className="section-desc">Loading...</div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

WeatherTempWidget.propTypes = {
    weatherData: PropTypes.shape({
        city: PropTypes.string,
        temperature: PropTypes.number,
        tempMin: PropTypes.number,
        tempMax: PropTypes.number,
        description: PropTypes.string,
        icon: PropTypes.string,
        humidity: PropTypes.number,
        windSpeed: PropTypes.number,
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

export default WeatherTempWidget;
