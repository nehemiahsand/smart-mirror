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
            const oAuth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                redirect_uris[0]
            );

            // Check if token exists
            try {
                const tokenContent = await fs.readFile(TOKEN_PATH, 'utf8');
                const token = JSON.parse(tokenContent);
                oAuth2Client.setCredentials(token);
                this.calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
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
            
            const oAuth2Client = new google.auth.OAuth2(
                client_id,
                client_secret,
                redirect_uris[0]
            );

            const { tokens } = await oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);

            // Save token for future use
            await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            
            this.calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
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
            const timeMax = new Date();
            timeMax.setDate(timeMax.getDate() + daysAhead);

            const response = await this.calendar.events.list({
                calendarId: 'primary',
                timeMin: now.toISOString(),
                timeMax: timeMax.toISOString(),
                maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            });

            const events = response.data.items || [];
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today for all-day event comparison

            // Format events and filter out past all-day events
            return events
                .map(event => ({
                    id: event.id,
                    title: event.summary,
                    startDate: event.start.dateTime || event.start.date,
                    endDate: event.end.dateTime || event.end.date,
                    fullDayEvent: !event.start.dateTime,
                    location: event.location,
                    description: event.description,
                }))
                .filter(event => {
                    // For all-day events, filter out past dates
                    if (event.fullDayEvent) {
                        const eventDate = new Date(event.startDate);
                        return eventDate >= today;
                    }
                    // Timed events are already filtered by timeMin in the API call
                    return true;
                });
        } catch (error) {
            logger.error('Failed to fetch calendar events:', error);
            throw error;
        }
    }

    isInitialized() {
        return this.initialized;
    }
}

module.exports = new GoogleCalendarService();
