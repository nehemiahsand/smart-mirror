import React from 'react';
import PropTypes from 'prop-types';
import './TimeDate.css';
import { useSharedTime } from '../hooks/useSharedTime';

/**
 * TimeDateWidget - Combined time and date display using system time
 * @param {string} format - Time format: '12h' or '24h'
 * @param {string} className - Additional CSS classes
 */
const TimeDateWidget = ({ format = '12h', className = '' }) => {
    const currentTime = useSharedTime();

    const getTimeData = () => {
        // Get timezone from TZ environment variable (set in docker-compose.yml)
        // Falls back to system timezone if not set
        const timezone = import.meta.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Format time in detected timezone
        const timeOptions = {
            timeZone: timezone,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        };

        const dateOptions = {
            timeZone: timezone,
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        };

        const timeStr = currentTime.toLocaleTimeString('en-US', timeOptions);
        const [hoursStr, minutesStr, secondsStr] = timeStr.split(':');

        let hours = parseInt(hoursStr);
        const isPM = hours >= 12;

        if (format === '12h') {
            hours = hours % 12 || 12;
        }

        const dateParts = currentTime.toLocaleDateString('en-US', dateOptions).split(', ');
        const dayName = dateParts[0];
        const [monthName, day] = dateParts[1].split(' ');
        const year = dateParts[2];

        return {
            dayName,
            monthName,
            day: parseInt(day),
            year: parseInt(year),
            hours: hours.toString().padStart(2, '0'),
            minutes: minutesStr,
            seconds: secondsStr.padStart(2, '0'),
            period: format === '12h' ? (isPM ? 'PM' : 'AM') : null
        };
    };

    const { dayName, monthName, day, year, hours, minutes, seconds, period } = getTimeData();

    return (
        <div className={`widget timedate-widget ${className}`}>
            <div className="timedate-time">
                {hours}:{minutes}
                <span className="timedate-seconds">:{seconds}</span>
                {period && <span className="timedate-period">{period}</span>}
            </div>
            <div className="timedate-date">
                {dayName}, {monthName} {day}, {year}
            </div>
        </div>
    );
};

TimeDateWidget.propTypes = {
    format: PropTypes.string,
    className: PropTypes.string
};

export default TimeDateWidget;
