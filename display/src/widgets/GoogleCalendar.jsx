import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './GoogleCalendar.css';

/**
 * GoogleCalendar Widget - Displays upcoming events from Google Calendar
 * @param {string} className - Additional CSS classes
 */
const GoogleCalendarWidget = ({ className = '' }) => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchEvents();
        // Refresh every 5 minutes
        const interval = setInterval(fetchEvents, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchEvents = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/calendar/events');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch calendar events');
            }
            const data = await response.json();
            setEvents(data.events || []);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch calendar events:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const formatEventTime = (event) => {
        const now = new Date();
        
        if (event.fullDayEvent) {
            // For all-day events, parse the date correctly (YYYY-MM-DD format)
            // Add 'T00:00:00' to treat it as local time, not UTC
            const dateParts = event.startDate.split('-');
            const start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            
            // Check if it's today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (start.getTime() === today.getTime()) {
                return 'Today';
            }
            
            // Check if it's tomorrow
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (start.getTime() === tomorrow.getTime()) {
                return 'Tomorrow';
            }
            
            return start.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }

        // For timed events, parse normally
        const start = new Date(event.startDate);
        
        // For timed events, always show time
        const timeStr = start.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        // If event is today, just show time
        if (start.toDateString() === now.toDateString()) {
            return timeStr;
        }

        // If event is tomorrow
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (start.toDateString() === tomorrow.toDateString()) {
            return `Tomorrow ${timeStr}`;
        }

        // Otherwise show day and time
        const dayStr = start.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        return `${dayStr} ${timeStr}`;
    };

    const truncateText = (text, maxLength = 30) => {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    if (error && error.includes('AUTH_NEEDED')) {
        return (
            <div className={`widget google-calendar-widget ${className}`}>
                <div className="calendar-error">
                    <p>Calendar not configured</p>
                    <p className="calendar-error-detail">Set up Google Calendar in PWA Settings</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={`widget google-calendar-widget ${className}`}>
                <div className="calendar-loading">Loading calendar...</div>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className={`widget google-calendar-widget ${className}`}>
                <div className="calendar-empty">No upcoming events</div>
            </div>
        );
    }

    return (
        <div className={`widget google-calendar-widget ${className}`}>
            <h2 className="calendar-header">UP NEXT</h2>
            <div className="calendar-events">
                {events.slice(0, 5).map((event, index) => (
                    <div key={event.id || index} className="calendar-event">
                        <div className="event-time">
                            {formatEventTime(event)}
                        </div>
                        <div className="event-title">
                            {truncateText(event.title)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

GoogleCalendarWidget.propTypes = {
    className: PropTypes.string
};

export default GoogleCalendarWidget;
