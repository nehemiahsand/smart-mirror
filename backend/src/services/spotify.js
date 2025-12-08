/**
 * Spotify Service - Handles Spotify Web API integration
 */

const axios = require('axios');
const logger = require('../utils/logger');
const settingsService = require('./settings');

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com';

class SpotifyService {
    constructor() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
        this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3001/api/spotify/callback';
        
        // Load tokens from settings
        this.loadTokens();
    }

    loadTokens() {
        try {
            const settings = settingsService.getAll();
            logger.info('Loading Spotify tokens - settings:', { hasSpotify: !!settings.spotify });
            if (settings.spotify) {
                this.accessToken = settings.spotify.accessToken;
                this.refreshToken = settings.spotify.refreshToken;
                this.tokenExpiry = settings.spotify.tokenExpiry;
                logger.info('Spotify tokens loaded from settings');
            } else {
                logger.info('No Spotify settings found');
            }
        } catch (error) {
            logger.error('Failed to load Spotify tokens:', error);
        }
    }

    async saveTokens() {
        try {
            await settingsService.updateMultiple({
                'spotify.accessToken': this.accessToken,
                'spotify.refreshToken': this.refreshToken,
                'spotify.tokenExpiry': this.tokenExpiry
            });
            logger.info('Spotify tokens saved to settings');
        } catch (error) {
            logger.error('Failed to save Spotify tokens:', error);
        }
    }

    getAuthUrl() {
        const scopes = [
            'user-read-playback-state',
            'user-modify-playback-state',
            'user-read-currently-playing',
            'streaming',
            'user-read-email',
            'user-read-private'
        ];

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            scope: scopes.join(' '),
            redirect_uri: this.redirectUri
        });

        return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
    }

    async exchangeCode(code) {
        try {
            const response = await axios.post(
                `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.redirectUri
                }),
                {
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64'),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

            await this.saveTokens();
            logger.info('Spotify tokens exchanged successfully');

            return {
                success: true,
                accessToken: this.accessToken
            };
        } catch (error) {
            logger.error('Failed to exchange Spotify code:', error.response?.data || error.message);
            throw error;
        }
    }

    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await axios.post(
                `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken
                }),
                {
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(this.clientId + ':' + this.clientSecret).toString('base64'),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

            await this.saveTokens();
            logger.info('Spotify access token refreshed');

            return this.accessToken;
        } catch (error) {
            logger.error('Failed to refresh Spotify token:', error.response?.data || error.message);
            throw error;
        }
    }

    async ensureValidToken() {
        if (!this.accessToken) {
            throw new Error('Not authenticated with Spotify');
        }

        // Refresh if token expires in less than 5 minutes
        if (this.tokenExpiry && this.tokenExpiry - Date.now() < 5 * 60 * 1000) {
            await this.refreshAccessToken();
        }

        return this.accessToken;
    }

    async makeRequest(method, endpoint, data = null) {
        const token = await this.ensureValidToken();

        try {
            const config = {
                method,
                url: `${SPOTIFY_API_BASE}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                // Token expired, try refreshing once
                await this.refreshAccessToken();
                return this.makeRequest(method, endpoint, data);
            }
            throw error;
        }
    }

    // Playback Control Methods
    async getCurrentPlayback() {
        return this.makeRequest('GET', '/me/player');
    }

    async getCurrentlyPlaying() {
        return this.makeRequest('GET', '/me/player/currently-playing');
    }

    async play(deviceId = null, contextUri = null) {
        const endpoint = deviceId ? `/me/player/play?device_id=${deviceId}` : '/me/player/play';
        const data = contextUri ? { context_uri: contextUri } : undefined;
        return this.makeRequest('PUT', endpoint, data);
    }

    async playLikedSongs() {
        // Get user's saved tracks and start playback
        const savedTracks = await this.makeRequest('GET', '/me/tracks?limit=50');
        if (savedTracks.items && savedTracks.items.length > 0) {
            const trackUris = savedTracks.items.map(item => item.track.uri);
            return this.makeRequest('PUT', '/me/player/play', {
                uris: trackUris
            });
        }
        throw new Error('No liked songs found');
    }

    async pause() {
        return this.makeRequest('PUT', '/me/player/pause');
    }

    async next() {
        return this.makeRequest('POST', '/me/player/next');
    }

    async previous() {
        return this.makeRequest('POST', '/me/player/previous');
    }

    async setVolume(volumePercent) {
        return this.makeRequest('PUT', `/me/player/volume?volume_percent=${volumePercent}`);
    }

    async seek(positionMs) {
        return this.makeRequest('PUT', `/me/player/seek?position_ms=${positionMs}`);
    }

    async getDevices() {
        return this.makeRequest('GET', '/me/player/devices');
    }

    async transferPlayback(deviceId, play = false) {
        return this.makeRequest('PUT', '/me/player', {
            device_ids: [deviceId],
            play
        });
    }

    isAuthenticated() {
        return !!this.accessToken;
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        settingsService.updateMultiple({
            'spotify.accessToken': null,
            'spotify.refreshToken': null,
            'spotify.tokenExpiry': null
        });
        logger.info('Spotify tokens cleared');
    }
}

module.exports = new SpotifyService();
