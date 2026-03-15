/**
 * Spotify API Routes
 */

const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotify');
const logger = require('../utils/logger');
const adminAuth = require('../middleware/adminAuth');
const adminOrApiKey = require('../middleware/adminOrApiKey');
const { consumeOAuthState, issueOAuthState } = require('../utils/oauthState');

function isSpotifyAuthError(error) {
    return error?.message === 'Not authenticated with Spotify' || error?.message === 'No refresh token available';
}

function sendSpotifyAuthNeeded(res) {
    return res.status(401).json({
        error: 'AUTH_NEEDED',
        details: 'Spotify authentication is required'
    });
}

// Get Spotify authentication URL
router.get('/auth-url', adminAuth, (req, res) => {
    try {
        const state = issueOAuthState('spotify');
        const authUrl = spotifyService.getAuthUrl(state);
        res.json({ authUrl, state });
    } catch (error) {
        logger.error('Error getting Spotify auth URL:', error);
        res.status(500).json({ error: 'Failed to get authentication URL' });
    }
});

// Handle Spotify OAuth callback
router.get('/callback', async (req, res) => {
    const { code, error, state } = req.query;

    if (error) {
        logger.error('Spotify auth error:', error);
        return res.redirect(`/settings?spotify=error&reason=${encodeURIComponent(error)}`);
    }

    if (!code) {
        return res.redirect('/settings?spotify=error&reason=no_code');
    }

    if (!consumeOAuthState('spotify', state)) {
        logger.warn('Spotify callback rejected due to invalid OAuth state');
        return res.redirect('/settings?spotify=error&reason=invalid_state');
    }

    try {
        await spotifyService.exchangeCode(code);
        res.redirect('/settings?spotify=connected');
    } catch (error) {
        logger.error('Error exchanging Spotify code:', error);
        res.redirect('/settings?spotify=error');
    }
});

// Get authentication status
router.get('/status', (req, res) => {
    res.json({
        configured: !!spotifyService.clientId && !!spotifyService.clientSecret,
        authenticated: spotifyService.isAuthenticated(),
        hasToken: !!spotifyService.accessToken
    });
});

// Clear authentication
router.post('/logout', adminAuth, (req, res) => {
    spotifyService.clearTokens();
    res.json({ success: true });
});

// Get current playback state
router.get('/player', async (req, res) => {
    try {
        const playback = await spotifyService.getCurrentPlayback();
        res.json(playback || { is_playing: false });
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error getting playback state:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to get playback state',
            details: error.message
        });
    }
});

// Get currently playing track
router.get('/currently-playing', async (req, res) => {
    try {
        const track = await spotifyService.getCurrentlyPlaying();
        res.json(track || {});
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error getting currently playing:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to get currently playing track',
            details: error.message
        });
    }
});

// Play
router.put('/play', adminOrApiKey, async (req, res) => {
    try {
        await spotifyService.play(req.body.device_id, req.body.context_uri);
        res.json({ success: true });
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error playing:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to play',
            details: error.message
        });
    }
});

// Play liked songs
router.put('/play-liked', adminOrApiKey, async (req, res) => {
    try {
        await spotifyService.playLikedSongs();
        res.json({ success: true });
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error playing liked songs:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to play liked songs',
            details: error.message
        });
    }
});

// Pause
router.put('/pause', adminOrApiKey, async (req, res) => {
    try {
        await spotifyService.pause();
        res.json({ success: true });
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error pausing:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to pause',
            details: error.message
        });
    }
});

// Next track
router.post('/next', adminOrApiKey, async (req, res) => {
    try {
        await spotifyService.next();
        res.json({ success: true });
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error skipping to next:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to skip to next track',
            details: error.message
        });
    }
});

// Previous track
router.post('/previous', adminOrApiKey, async (req, res) => {
    try {
        await spotifyService.previous();
        res.json({ success: true });
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error going to previous:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to go to previous track',
            details: error.message
        });
    }
});

// Set volume
router.put('/volume', adminOrApiKey, async (req, res) => {
    try {
        const { volume } = req.body;
        if (volume === undefined || volume < 0 || volume > 100) {
            return res.status(400).json({ error: 'Volume must be between 0 and 100' });
        }
        await spotifyService.setVolume(volume);
        res.json({ success: true });
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error setting volume:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to set volume',
            details: error.message
        });
    }
});

// Seek to position
router.put('/seek', adminOrApiKey, async (req, res) => {
    try {
        const { position } = req.body;
        if (position === undefined || position < 0) {
            return res.status(400).json({ error: 'Position must be >= 0' });
        }
        await spotifyService.seek(position);
        res.json({ success: true });
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error seeking:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to seek',
            details: error.message
        });
    }
});

// Get available devices
router.get('/devices', async (req, res) => {
    try {
        const devices = await spotifyService.getDevices();
        res.json(devices);
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error getting devices:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to get devices',
            details: error.message
        });
    }
});

// Get playlist info
router.get('/playlist/:id', async (req, res) => {
    try {
        const playlist = await spotifyService.getPlaylist(req.params.id);
        res.json(playlist);
    } catch (error) {
        if (isSpotifyAuthError(error)) {
            return sendSpotifyAuthNeeded(res);
        }
        logger.error('Error getting playlist:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to get playlist',
            details: error.message
        });
    }
});

module.exports = router;
