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
        this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost/api/spotify/callback';
        
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

    getAuthUrl(state, redirectUriOverride = null) {
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
            redirect_uri: redirectUriOverride || this.redirectUri,
            state
        });

        return `${SPOTIFY_ACCOUNTS_BASE}/authorize?${params.toString()}`;
    }

    async exchangeCode(code, redirectUriOverride = null) {
        try {
            const response = await axios.post(
                `${SPOTIFY_ACCOUNTS_BASE}/api/token`,
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: redirectUriOverride || this.redirectUri
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

    isNoActiveDeviceError(error) {
        if (error.response?.status !== 404) {
            return false;
        }

        const spotifyError = error.response?.data?.error || {};
        const reason = String(spotifyError.reason || '').toUpperCase();
        const message = String(spotifyError.message || error.message || '').toLowerCase();
        return reason === 'NO_ACTIVE_DEVICE' || message.includes('no active device');
    }

    selectPlaybackDevice(devices = []) {
        const availableDevices = Array.isArray(devices)
            ? devices.filter((device) => device && device.id && device.is_restricted !== true)
            : [];

        const activeDevice = availableDevices.find((device) => device.is_active === true);
        if (activeDevice) {
            return activeDevice;
        }

        const settings = settingsService.get('spotify') || {};
        const preferredDeviceId = settings.deviceId || settings.preferredDeviceId;
        if (preferredDeviceId) {
            const preferredDevice = availableDevices.find((device) => device.id === preferredDeviceId);
            if (preferredDevice) {
                return preferredDevice;
            }
        }

        const preferredDeviceName = String(settings.deviceName || settings.preferredDeviceName || '').trim().toLowerCase();
        if (preferredDeviceName) {
            const preferredNamedDevice = availableDevices.find((device) => (
                String(device.name || '').trim().toLowerCase() === preferredDeviceName
            ));
            if (preferredNamedDevice) {
                return preferredNamedDevice;
            }
        }

        return availableDevices[0] || null;
    }

    async getPlaybackDevice() {
        const devicesResponse = await this.getDevices();
        const device = this.selectPlaybackDevice(devicesResponse?.devices || []);
        if (!device) {
            throw new Error('No available Spotify playback devices');
        }
        return device;
    }

    async activatePlaybackDevice(play = false) {
        const device = await this.getPlaybackDevice();
        if (!device.is_active) {
            await this.transferPlayback(device.id, play);
            logger.info('Spotify playback transferred to available device', {
                deviceName: device.name,
                play,
            });
        }
        return device;
    }

    async retryWithActiveDevice(error, retry, { play = false } = {}) {
        if (!this.isNoActiveDeviceError(error)) {
            throw error;
        }

        const device = await this.activatePlaybackDevice(play);
        return retry(device);
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
        try {
            return await this.makeRequest('PUT', endpoint, data);
        } catch (error) {
            return this.retryWithActiveDevice(error, (device) => {
                const retryEndpoint = `/me/player/play?device_id=${encodeURIComponent(device.id)}`;
                return this.makeRequest('PUT', retryEndpoint, data);
            }, { play: false });
        }
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
        try {
            return await this.makeRequest('PUT', '/me/player/pause');
        } catch (error) {
            if (this.isNoActiveDeviceError(error)) {
                logger.info('Spotify pause skipped because no active playback device is available');
                return null;
            }
            throw error;
        }
    }

    async next() {
        try {
            return await this.makeRequest('POST', '/me/player/next');
        } catch (error) {
            return this.retryWithActiveDevice(error, (device) => (
                this.makeRequest('POST', `/me/player/next?device_id=${encodeURIComponent(device.id)}`)
            ), { play: true });
        }
    }

    async previous() {
        try {
            return await this.makeRequest('POST', '/me/player/previous');
        } catch (error) {
            return this.retryWithActiveDevice(error, (device) => (
                this.makeRequest('POST', `/me/player/previous?device_id=${encodeURIComponent(device.id)}`)
            ), { play: true });
        }
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

    async getPlaylist(playlistId) {
        return this.makeRequest('GET', `/playlists/${playlistId}?fields=name,description,images,owner`);
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
