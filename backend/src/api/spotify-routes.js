/**
 * Spotify API Routes
 */

const express = require('express');
const router = express.Router();
const spotifyService = require('../services/spotify');
const logger = require('../utils/logger');

// Get Spotify authentication URL
router.get('/auth-url', (req, res) => {
    try {
        const authUrl = spotifyService.getAuthUrl();
        res.json({ authUrl });
    } catch (error) {
        logger.error('Error getting Spotify auth URL:', error);
        res.status(500).json({ error: 'Failed to get authentication URL' });
    }
});

// Handle Spotify OAuth callback
router.get('/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        logger.error('Spotify auth error:', error);
        return res.redirect(`/spotify-error?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
        return res.redirect('/spotify-error?error=no_code');
    }

    try {
        await spotifyService.exchangeCode(code);
        // Redirect to display on port 3000 with success message
        res.redirect('http://localhost:3000?spotify=connected');
    } catch (error) {
        logger.error('Error exchanging Spotify code:', error);
        res.redirect('http://localhost:3000?spotify=error');
    }
});

// Get authentication status
router.get('/status', (req, res) => {
    res.json({
        authenticated: spotifyService.isAuthenticated(),
        hasToken: !!spotifyService.accessToken
    });
});

// Clear authentication
router.post('/logout', (req, res) => {
    spotifyService.clearTokens();
    res.json({ success: true });
});

// Get current playback state
router.get('/player', async (req, res) => {
    try {
        const playback = await spotifyService.getCurrentPlayback();
        res.json(playback || { is_playing: false });
    } catch (error) {
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
        logger.error('Error getting currently playing:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to get currently playing track',
            details: error.message
        });
    }
});

// Play
router.put('/play', async (req, res) => {
    try {
        await spotifyService.play(req.body.device_id, req.body.context_uri);
        res.json({ success: true });
    } catch (error) {
        logger.error('Error playing:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to play',
            details: error.message
        });
    }
});

// Play liked songs
router.put('/play-liked', async (req, res) => {
    try {
        await spotifyService.playLikedSongs();
        res.json({ success: true });
    } catch (error) {
        logger.error('Error playing liked songs:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to play liked songs',
            details: error.message
        });
    }
});

// Pause
router.put('/pause', async (req, res) => {
    try {
        await spotifyService.pause();
        res.json({ success: true });
    } catch (error) {
        logger.error('Error pausing:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to pause',
            details: error.message
        });
    }
});

// Next track
router.post('/next', async (req, res) => {
    try {
        await spotifyService.next();
        res.json({ success: true });
    } catch (error) {
        logger.error('Error skipping to next:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to skip to next track',
            details: error.message
        });
    }
});

// Previous track
router.post('/previous', async (req, res) => {
    try {
        await spotifyService.previous();
        res.json({ success: true });
    } catch (error) {
        logger.error('Error going to previous:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to go to previous track',
            details: error.message
        });
    }
});

// Set volume
router.put('/volume', async (req, res) => {
    try {
        const { volume } = req.body;
        if (volume === undefined || volume < 0 || volume > 100) {
            return res.status(400).json({ error: 'Volume must be between 0 and 100' });
        }
        await spotifyService.setVolume(volume);
        res.json({ success: true });
    } catch (error) {
        logger.error('Error setting volume:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to set volume',
            details: error.message
        });
    }
});

// Seek to position
router.put('/seek', async (req, res) => {
    try {
        const { position } = req.body;
        if (position === undefined || position < 0) {
            return res.status(400).json({ error: 'Position must be >= 0' });
        }
        await spotifyService.seek(position);
        res.json({ success: true });
    } catch (error) {
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
        logger.error('Error getting devices:', error);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to get devices',
            details: error.message
        });
    }
});

module.exports = router;
