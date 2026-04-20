import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import TimeDateWidget from '../widgets/TimeDate';
import { apiFetch } from '../api/apiClient';
import './FunPage.css';
import './WeatherPage.css';

const HOURS_PER_ROW = 6;
const DAYPART_LABELS = {
    0: 'Night',
    6: 'Morning',
    12: 'Afternoon',
    18: 'Evening'
};

function getWeatherIcon(icon) {
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
}

function getDaypartLabel(timestamp) {
    if (!Number.isFinite(timestamp)) {
        return 'Later';
    }

    const hour = new Date(timestamp * 1000).getHours();
    if (hour < 5) {
        return 'Overnight';
    }
    if (hour < 12) {
        return 'Morning';
    }
    if (hour < 17) {
        return 'Afternoon';
    }
    if (hour < 21) {
        return 'Evening';
    }
    return 'Tonight';
}

function getHourKeyFromDate(date) {
    return [
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours()
    ].join('-');
}

function getHourKeyFromTimestamp(timestamp) {
    if (!Number.isFinite(timestamp)) {
        return null;
    }

    return getHourKeyFromDate(new Date(timestamp * 1000));
}

function getBaseBlockDate(now = new Date()) {
    const base = new Date(now);
    base.setMinutes(0, 0, 0);
    base.setHours(Math.floor(base.getHours() / HOURS_PER_ROW) * HOURS_PER_ROW);
    return base;
}

function formatHourRange(timestamp) {
    if (!Number.isFinite(timestamp)) {
        return '--';
    }

    return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true
    });
}

function getDayNightClass(icon) {
    if (typeof icon !== 'string') {
        return '';
    }

    if (icon.endsWith('n')) {
        return 'weather-page-hour-card-night';
    }

    if (icon.endsWith('d')) {
        return 'weather-page-hour-card-day';
    }

    return '';
}

function getHourIconClass(icon) {
    if (icon === '01n') {
        return 'weather-page-hour-icon-moon';
    }
    return '';
}

function getHourlyGroups(hourlyTimeline, currentWeather) {
    const now = new Date();
    const currentHourKey = getHourKeyFromDate(now);
    const baseBlockDate = getBaseBlockDate(now);
    const forecastMap = new Map();

    if (Array.isArray(hourlyTimeline)) {
        hourlyTimeline.forEach((entry) => {
            const key = getHourKeyFromTimestamp(entry?.timestamp);
            if (key) {
                forecastMap.set(key, entry);
            }
        });
    }

    const groups = [];
    for (let groupIndex = 0; groupIndex < 4; groupIndex += 1) {
        const groupStart = new Date(baseBlockDate.getTime() + (groupIndex * HOURS_PER_ROW * 60 * 60 * 1000));
        const entries = [];

        for (let offset = 0; offset < HOURS_PER_ROW; offset += 1) {
            const slotDate = new Date(groupStart.getTime() + (offset * 60 * 60 * 1000));
            const slotTimestamp = Math.floor(slotDate.getTime() / 1000);
            const slotKey = getHourKeyFromDate(slotDate);
            const forecastEntry = forecastMap.get(slotKey);
            const isCurrentHour = slotKey === currentHourKey;

            if (forecastEntry) {
                entries.push({
                    ...forecastEntry,
                    slotTimestamp,
                    timeLabel: formatHourRange(slotTimestamp),
                    isCurrentHour,
                    isPlaceholder: false
                });
                continue;
            }

            if (isCurrentHour && currentWeather) {
                entries.push({
                    timestamp: slotTimestamp,
                    slotTimestamp,
                    timeLabel: formatHourRange(slotTimestamp),
                    temperature: currentWeather.temperature,
                    description: currentWeather.description,
                    icon: currentWeather.icon,
                    precipitationChance: null,
                    isCurrentHour: true,
                    isPlaceholder: false,
                    isCurrentSnapshot: true
                });
                continue;
            }

            entries.push({
                timestamp: slotTimestamp,
                slotTimestamp,
                timeLabel: formatHourRange(slotTimestamp),
                temperature: null,
                description: '',
                icon: '',
                precipitationChance: null,
                isCurrentHour: false,
                isPlaceholder: slotDate < now
            });
        }

        const startTimestamp = entries[0]?.slotTimestamp;
        const endTimestamp = entries[entries.length - 1]?.slotTimestamp;
        const startHour = groupStart.getHours();
        const label = DAYPART_LABELS[startHour] || getDaypartLabel(startTimestamp);

        groups.push({
            id: `${groupIndex}-${startTimestamp || 'group'}`,
            label,
            timeRangeLabel: `${formatHourRange(startTimestamp)}-${formatHourRange(endTimestamp)}`,
            primary: groupIndex === 0,
            entries
        });
    }
    return groups;
}

function getHourCardAccent(entry) {
    const precipitation = Number(entry?.precipitationChance || 0);
    if (entry?.icon?.startsWith('11')) {
        return 'weather-page-hour-card-alert';
    }
    if (entry?.icon?.startsWith('13')) {
        return 'weather-page-hour-card-cold';
    }
    if (precipitation >= 40 || entry?.icon?.startsWith('09') || entry?.icon?.startsWith('10')) {
        return 'weather-page-hour-card-rain';
    }
    return '';
}

function getSectionOrder(settings, sectionId) {
    const order = Array.isArray(settings?.weatherWidgetOrder) ? settings.weatherWidgetOrder : ['timedate', 'sunmoon', 'temps', 'hourly'];
    const index = order.indexOf(sectionId);
    return index === -1 ? 999 : index;
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

function DailyWeatherCard({ city, summary }) {
    if (!summary) {
        return (
            <div className="fun-panel weather-page-daily-card">
                <div className="fun-panel-title">Today</div>
                <div className="fun-widget-empty">Daily weather unavailable</div>
            </div>
        );
    }

    return (
        <div className="fun-panel weather-page-daily-card">
            <div className="fun-panel-header">
                <div className="fun-panel-title">{city || 'Weather'}</div>
                <span className="weather-page-day-label">{summary.label || 'Today'}</span>
            </div>

            <div className="weather-page-daily-main">
                <div className="weather-page-daily-icon" aria-hidden="true">{getWeatherIcon(summary.icon)}</div>
                <div className="weather-page-daily-copy">
                    <div className="weather-page-current-temp">{summary.current ?? '--'}°</div>
                    <div className="weather-page-condition">{summary.description || 'Conditions unavailable'}</div>
                    <div className="weather-page-highlow">
                        <span>High {summary.high ?? '--'}°</span>
                        <span>Low {summary.low ?? '--'}°</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

DailyWeatherCard.propTypes = {
    city: PropTypes.string,
    summary: PropTypes.shape({
        label: PropTypes.string,
        current: PropTypes.number,
        high: PropTypes.number,
        low: PropTypes.number,
        description: PropTypes.string,
        icon: PropTypes.string
    })
};

function IndoorWeatherCard({ climate }) {
    if (!climate) {
        return (
            <div className="fun-panel weather-page-daily-card weather-page-inside-card">
                <div className="fun-panel-title">Inside</div>
                <div className="fun-widget-empty">Indoor climate unavailable</div>
            </div>
        );
    }

    return (
        <div className="fun-panel weather-page-daily-card weather-page-inside-card">
            <div className="fun-panel-header">
                <div className="fun-panel-title">Inside</div>
                <span className="weather-page-day-label">Now</span>
            </div>

            <div className="weather-page-daily-main">
                <div className="weather-page-daily-icon" aria-hidden="true">🏠</div>
                <div className="weather-page-daily-copy">
                    <div className="weather-page-current-temp">{climate.temperatureFahrenheit ?? '--'}°</div>
                    <div className="weather-page-condition">
                        {climate.temperatureCelsius ?? '--'}°C
                    </div>
                    <div className="weather-page-highlow">
                        <span>Humidity {climate.humidity ?? '--'}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

IndoorWeatherCard.propTypes = {
    climate: PropTypes.shape({
        temperatureFahrenheit: PropTypes.number,
        temperatureCelsius: PropTypes.number,
        humidity: PropTypes.number
    })
};

function HourlyWeather({ hourly, hourlyTimeline, currentWeather }) {
    const effectiveTimeline = Array.isArray(hourlyTimeline) && hourlyTimeline.length > 0 ? hourlyTimeline : hourly;

    if (!Array.isArray(effectiveTimeline) || effectiveTimeline.length === 0) {
        return (
            <div className="fun-panel weather-page-hourly">
                <div className="fun-panel-title">Hourly</div>
                <div className="fun-widget-empty">Hourly forecast unavailable</div>
            </div>
        );
    }

    const hourlyGroups = getHourlyGroups(effectiveTimeline, currentWeather);
    return (
        <div className="fun-panel weather-page-hourly">
            <div className="fun-panel-header">
                <div className="fun-panel-title">Hourly</div>
                <span className="weather-page-day-label">24-Hour Outlook</span>
            </div>

            <div className="weather-page-hourly-groups">
                {hourlyGroups.map((group) => (
                    <section
                        key={group.id}
                        className={`weather-page-hour-group ${group.primary ? 'weather-page-hour-group-primary' : ''}`}
                    >
                        <div className="weather-page-hour-group-header">
                            <span className="weather-page-hour-group-title">{group.label}</span>
                            <span className="weather-page-hour-group-range">{group.timeRangeLabel}</span>
                        </div>

                        <div className="weather-page-hourly-grid">
                            {group.entries.map((entry) => {
                                const accentClassName = getHourCardAccent(entry);
                                const dayNightClassName = getDayNightClass(entry.icon);
                                const iconClassName = getHourIconClass(entry.icon);
                                const placeholderClassName = entry.isPlaceholder ? 'weather-page-hour-card-placeholder' : '';
                                const currentClassName = entry.isCurrentHour ? 'weather-page-hour-card-current' : '';
                                return (
                                    <div
                                        key={`${entry.slotTimestamp || entry.timestamp}-${entry.timeLabel}`}
                                        className={`weather-page-hour-card ${accentClassName} ${dayNightClassName} ${placeholderClassName} ${currentClassName}`.trim()}
                                    >
                                        <div className="weather-page-hour-label">
                                            {entry.timeLabel || '--'}
                                            {entry.isCurrentHour ? <span className="weather-page-hour-now-pill">Now</span> : null}
                                        </div>
                                        <div className={`weather-page-hour-icon ${iconClassName}`.trim()} aria-hidden="true">
                                            {entry.isPlaceholder ? '·' : getWeatherIcon(entry.icon)}
                                        </div>
                                        <div className="weather-page-hour-temp">
                                            {Number.isFinite(entry.temperature) ? `${entry.temperature}°` : '--'}
                                        </div>
                                        <div className="weather-page-hour-badge">
                                            {entry.isPlaceholder
                                                ? 'Passed'
                                                : entry.isCurrentHour && entry.precipitationChance == null
                                                ? 'Current'
                                                : `${Number(entry.precipitationChance || 0)}% rain`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

HourlyWeather.propTypes = {
    hourly: PropTypes.arrayOf(PropTypes.shape({
        timestamp: PropTypes.number,
        slotTimestamp: PropTypes.number,
        timeLabel: PropTypes.string,
        temperature: PropTypes.number,
        description: PropTypes.string,
        icon: PropTypes.string,
        precipitationChance: PropTypes.number
    })),
    hourlyTimeline: PropTypes.arrayOf(PropTypes.shape({
        timestamp: PropTypes.number,
        timeLabel: PropTypes.string,
        temperature: PropTypes.number,
        description: PropTypes.string,
        icon: PropTypes.string,
        precipitationChance: PropTypes.number
    })),
    currentWeather: PropTypes.shape({
        temperature: PropTypes.number,
        description: PropTypes.string,
        icon: PropTypes.string
    })
};

export default function WeatherPage({ pageData, settings }) {
    const [data, setData] = useState(pageData || null);

    useEffect(() => {
        if (pageData) {
            setData(pageData);
        }
    }, [pageData]);

    useEffect(() => {
        let mounted = true;

        const fetchWeatherPage = async () => {
            try {
                const response = await apiFetch('/api/console/page/weather');
                const nextData = await response.json();
                if (mounted) {
                    setData(nextData);
                }
            } catch (error) {
                console.error('Failed to fetch weather page data:', error);
            }
        };

        fetchWeatherPage();
        const intervalId = setInterval(fetchWeatherPage, 60 * 1000);

        return () => {
            mounted = false;
            clearInterval(intervalId);
        };
    }, []);

    return (
        <div className="mirror weather-page">
            <div className="weather-page-content">
                <div className="weather-page-time-section" style={{ order: getSectionOrder(settings, 'timedate') }}>
                    <TimeDateWidget />
                </div>

                <div className="weather-page-sunmoon-row" style={{ order: getSectionOrder(settings, 'sunmoon') }}>
                    <SunWidget widget={data?.sun} />
                    <MoonWidget widget={data?.moon} />
                </div>

                <div className="weather-page-daily-row" style={{ order: getSectionOrder(settings, 'temps') }}>
                    <DailyWeatherCard city={data?.city} summary={data?.dailySummary} />
                    <IndoorWeatherCard climate={data?.indoorClimate} />
                </div>

                <div className="weather-page-hourly-section" style={{ order: getSectionOrder(settings, 'hourly') }}>
                    <HourlyWeather
                        hourly={data?.hourly}
                        hourlyTimeline={data?.hourlyTimeline}
                        currentWeather={data?.currentWeather}
                    />
                </div>
            </div>
        </div>
    );
}

WeatherPage.propTypes = {
    pageData: PropTypes.shape({
        city: PropTypes.string,
        indoorClimate: PropTypes.object,
        dailySummary: PropTypes.object,
        sun: PropTypes.object,
        moon: PropTypes.object,
        hourly: PropTypes.array,
        hourlyTimeline: PropTypes.array
    }),
    settings: PropTypes.shape({
        weatherWidgetOrder: PropTypes.array
    })
};
