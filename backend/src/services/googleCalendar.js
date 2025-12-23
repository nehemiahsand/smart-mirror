const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const CREDENTIALS_PATH = path.join(__dirname, '../../data/calendar-credentials.json');
const TOKEN_PATH = path.join(__dirname, '../../data/calendar-token.json');
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

class GoogleCalendarService {
    constructor() {
        this.calendar = null;
        this.initialized = false;
        this.oAuth2Client = null;
    }

    async initialize() {
        try {
            // Check if credentials exist
            try {
                await fs.access(CREDENTIALS_PATH);
            } catch {
                logger.info('Google Calendar credentials not found');
                this.initialized = false;
                return;
            }

            // Load credentials
            const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
            const credentials = JSON.parse(credentialsContent);

            if (!credentials.installed) {
                throw new Error('Invalid credentials format. Expected "installed" OAuth client.');
            }

            const { client_id, client_secret, redirect_uris } = credentials.installed;
            this.oAuth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                redirect_uris[0]
            );

            // Set up token refresh handler - this will automatically save refreshed tokens
            this.oAuth2Client.on('tokens', async (tokens) => {
                try {
                    logger.info('Google Calendar tokens refreshed');
                    // Read the existing token file to preserve refresh_token if not included
                    let existingTokens = {};
                    try {
                        const existingContent = await fs.readFile(TOKEN_PATH, 'utf8');
                        existingTokens = JSON.parse(existingContent);
                    } catch (err) {
                        // Ignore if file doesn't exist
                    }
                    
                    // Merge new tokens with existing, preserving refresh_token
                    const updatedTokens = {
                        ...existingTokens,
                        ...tokens,
                        // Keep the old refresh_token if new one isn't provided
                        refresh_token: tokens.refresh_token || existingTokens.refresh_token
                    };
                    
                    await fs.writeFile(TOKEN_PATH, JSON.stringify(updatedTokens, null, 2));
                } catch (error) {
                    logger.error('Failed to save refreshed tokens:', error);
                }
            });

            // Check if token exists
            try {
                const tokenContent = await fs.readFile(TOKEN_PATH, 'utf8');
                const token = JSON.parse(tokenContent);
                this.oAuth2Client.setCredentials(token);
                
                // Check if token is expired and refresh it proactively
                const expiryDate = token.expiry_date;
                if (expiryDate && expiryDate < Date.now()) {
                    logger.info('Access token expired, refreshing...');
                    try {
                        // This will automatically trigger the 'tokens' event handler
                        await this.oAuth2Client.getAccessToken();
                        logger.info('Token refreshed successfully');
                    } catch (refreshError) {
                        logger.error('Failed to refresh token on initialization:', refreshError);
                        // If refresh fails, mark as not initialized so user can re-auth
                        this.initialized = false;
                        return;
                    }
                }
                
                this.calendar = google.calendar({ version: 'v3', auth: this.oAuth2Client });
                this.initialized = true;
                logger.info('Google Calendar service initialized');
            } catch {
                logger.info('Google Calendar token not found. Authorization needed.');
                this.initialized = false;
            }
        } catch (error) {
            logger.error('Failed to initialize Google Calendar service:', error);
            this.initialized = false;
        }
    }

    async getAuthUrl() {
        try {
            const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
            const credentials = JSON.parse(credentialsContent);
            const { client_id, client_secret, redirect_uris } = credentials.installed;
            
            const oAuth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                redirect_uris[0]
            );

            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: SCOPES,
            });

            return authUrl;
        } catch (error) {
            logger.error('Failed to generate auth URL:', error);
            throw error;
        }
    }

    async authorize(code) {
        try {
            const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf8');
            const credentials = JSON.parse(credentialsContent);
            const { client_id, client_secret, redirect_uris } = credentials.installed;
            
            this.oAuth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                redirect_uris[0]
            );

            // Set up token refresh handler
            this.oAuth2Client.on('tokens', async (tokens) => {
                try {
                    logger.info('Google Calendar tokens refreshed');
                    let existingTokens = {};
                    try {
                        const existingContent = await fs.readFile(TOKEN_PATH, 'utf8');
                        existingTokens = JSON.parse(existingContent);
                    } catch (err) {
                        // Ignore if file doesn't exist
                    }
                    
                    const updatedTokens = {
                        ...existingTokens,
                        ...tokens,
                        refresh_token: tokens.refresh_token || existingTokens.refresh_token
                    };
                    
                    await fs.writeFile(TOKEN_PATH, JSON.stringify(updatedTokens, null, 2));
                } catch (error) {
                    logger.error('Failed to save refreshed tokens:', error);
                }
            });

            const { tokens } = await this.oAuth2Client.getToken(code);
            this.oAuth2Client.setCredentials(tokens);

            // Save token for future use
            await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            
            this.calendar = google.calendar({ version: 'v3', auth: this.oAuth2Client });
            this.initialized = true;
            
            logger.info('Google Calendar authorized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to authorize Google Calendar:', error);
            throw error;
        }
    }

    async getEvents(maxResults = 10, daysAhead = 7) {
        if (!this.initialized) {
            throw new Error('AUTH_NEEDED');
        }

        try {
            const now = new Date();
            
            // Use start of today for timeMin to include full-day events that started today
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            
            const timeMax = new Date();
            timeMax.setDate(timeMax.getDate() + daysAhead);

            // Get list of all calendars
            const calendarList = await this.calendar.calendarList.list();
            const calendars = calendarList.data.items || [];
            
            logger.info(`Found ${calendars.length} calendars`);

            // Fetch events from all calendars in parallel
            const allEventsPromises = calendars.map(async (cal) => {
                try {
                    const response = await this.calendar.events.list({
                        calendarId: cal.id,
                        timeMin: todayStart.toISOString(),
                        timeMax: timeMax.toISOString(),
                        maxResults: maxResults * 2, // Get more per calendar, will trim later
                        singleEvents: true,
                        orderBy: 'startTime',
                    });
                    
                    const events = response.data.items || [];
                    // Add calendar info to each event
                    return events.map(event => ({
                        ...event,
                        calendarName: cal.summary,
                        calendarColor: cal.backgroundColor
                    }));
                } catch (err) {
                    // Some calendars might not be accessible, skip them
                    logger.warn(`Could not fetch events from calendar "${cal.summary}": ${err.message}`);
                    return [];
                }
            });

            const allEventsArrays = await Promise.all(allEventsPromises);
            const allEvents = allEventsArrays.flat();

            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today for all-day event comparison

            // Format events and filter
            const formattedEvents = allEvents
                .map(event => ({
                    id: event.id,
                    title: event.summary,
                    startDate: event.start.dateTime || event.start.date,
                    endDate: event.end.dateTime || event.end.date,
                    fullDayEvent: !event.start.dateTime,
                    location: event.location,
                    description: event.description,
                    calendarName: event.calendarName,
                    calendarColor: event.calendarColor,
                }))
                .filter(event => {
                    if (event.fullDayEvent) {
                        // For all-day events, show them for the entire day (until the end date)
                        // Parse the date correctly as local time
                        const dateParts = event.endDate.split('-');
                        const eventEndDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                        // Keep the event if the end date is today or later
                        return eventEndDate > today;
                    } else {
                        // For timed events, filter out ones that have already ended
                        const eventEnd = new Date(event.endDate);
                        return eventEnd > now;
                    }
                })
                // Sort all events by start date
                .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
                // Limit to requested number
                .slice(0, maxResults);

            return formattedEvents;
        } catch (error) {
            logger.error('Failed to fetch calendar events:', error);
            
            // If it's an auth error, try to re-initialize with token refresh
            if (error.code === 401 || error.code === 403 || 
                (error.message && error.message.includes('invalid_grant'))) {
                logger.warn('Authentication error detected, attempting to refresh token');
                
                try {
                    // Force a token refresh
                    const { credentials } = await this.oAuth2Client.refreshAccessToken();
                    this.oAuth2Client.setCredentials(credentials);
                    
                    // Save the new tokens
                    let existingTokens = {};
                    try {
                        const existingContent = await fs.readFile(TOKEN_PATH, 'utf8');
                        existingTokens = JSON.parse(existingContent);
                    } catch (err) {
                        // Ignore
                    }
                    
                    const updatedTokens = {
                        ...existingTokens,
                        ...credentials,
                        refresh_token: credentials.refresh_token || existingTokens.refresh_token
                    };
                    await fs.writeFile(TOKEN_PATH, JSON.stringify(updatedTokens, null, 2));
                    
                    logger.info('Token refreshed successfully after 401, retrying request');
                    
                    // Retry the request once
                    return this.getEventsInternal(maxResults, daysAhead);
                } catch (refreshError) {
                    logger.error('Failed to refresh token after auth error:', refreshError);
                    this.initialized = false;
                    throw new Error('AUTH_NEEDED');
                }
            }
            
            throw error;
        }
    }

    // Internal method to avoid infinite retry loop
    async getEventsInternal(maxResults, daysAhead) {
        const now = new Date();
        
        // Use start of today for timeMin to include full-day events that started today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + daysAhead);

        // Get list of all calendars
        const calendarList = await this.calendar.calendarList.list();
        const calendars = calendarList.data.items || [];
        
        logger.info(`Found ${calendars.length} calendars`);

        // Fetch events from all calendars in parallel
        const allEventsPromises = calendars.map(async (cal) => {
            try {
                const response = await this.calendar.events.list({
                    calendarId: cal.id,
                    timeMin: todayStart.toISOString(),
                    timeMax: timeMax.toISOString(),
                    maxResults: maxResults * 2,
                    singleEvents: true,
                    orderBy: 'startTime',
                });
                
                const events = response.data.items || [];
                return events.map(event => ({
                    ...event,
                    calendarName: cal.summary,
                    calendarColor: cal.backgroundColor
                }));
            } catch (err) {
                logger.warn(`Could not fetch events from calendar "${cal.summary}": ${err.message}`);
                return [];
            }
        });

        const allEventsArrays = await Promise.all(allEventsPromises);
        const allEvents = allEventsArrays.flat();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return allEvents
            .map(event => ({
                id: event.id,
                title: event.summary,
                startDate: event.start.dateTime || event.start.date,
                endDate: event.end.dateTime || event.end.date,
                fullDayEvent: !event.start.dateTime,
                location: event.location,
                description: event.description,
                calendarName: event.calendarName,
                calendarColor: event.calendarColor,
            }))
            .filter(event => {
                if (event.fullDayEvent) {
                    // For all-day events, show them for the entire day (until the end date)
                    const dateParts = event.endDate.split('-');
                    const eventEndDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    return eventEndDate > today;
                } else {
                    // For timed events, filter out ones that have already ended
                    const eventEnd = new Date(event.endDate);
                    return eventEnd > now;
                }
            })
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
            .slice(0, maxResults);
    }

    async getCalendarList() {
        if (!this.initialized) {
            throw new Error('AUTH_NEEDED');
        }

        try {
            const calendarList = await this.calendar.calendarList.list();
            return (calendarList.data.items || []).map(cal => ({
                id: cal.id,
                name: cal.summary,
                description: cal.description,
                color: cal.backgroundColor,
                primary: cal.primary || false,
                accessRole: cal.accessRole
            }));
        } catch (error) {
            logger.error('Failed to fetch calendar list:', error);
            throw error;
        }
    }

    isInitialized() {
        return this.initialized;
    }
}

module.exports = new GoogleCalendarService();
