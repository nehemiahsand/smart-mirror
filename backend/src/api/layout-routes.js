/**
 * REST API endpoint for updating widget layout positions
 * 
 * POST /api/layout
 * {
 *   "widgets": {
 *     "clock": { "x": 50, "y": 10, "enabled": true },
 *     "date": { "x": 10, "y": 10, "enabled": true },
 *     "weather": { "x": 85, "y": 10, "enabled": true }
 *   }
 * }
 * 
 * GET /api/layout - Get current layout
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const settingsService = require('../services/settings');
const websocketServer = require('./websocket');

// Get current layout
router.get('/layout', (req, res) => {
  try {
    const settings = settingsService.getAll();
    const layout = settings.layout || { widgets: {} };
    res.json(layout);
  } catch (error) {
    logger.error('Failed to get layout', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve layout' });
  }
});

// Update layout
router.post('/layout', async (req, res) => {
  try {
    const { widgets } = req.body;
    
    if (!widgets || typeof widgets !== 'object') {
      return res.status(400).json({ error: 'Widgets configuration is required' });
    }

    // Update settings
    await settingsService.update('layout.widgets', widgets);

    // Broadcast layout change via WebSocket
    websocketServer.broadcast({
      type: 'layout_update',
      data: { widgets },
      timestamp: Date.now()
    });

    const updatedSettings = settingsService.getAll();
    res.json({
      success: true,
      layout: updatedSettings.layout,
      message: 'Layout updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update layout', { error: error.message });
    res.status(500).json({ error: 'Failed to update layout' });
  }
});

// Apply layout preset
router.post('/layout/preset/:presetName', async (req, res) => {
  try {
    const { presetName } = req.params;
    
    // Load preset (you can expand this with actual preset storage)
    const presets = {
      default: {
        clock: { x: 50, y: 10, enabled: true },
        date: { x: 10, y: 10, enabled: true },
        weather: { x: 85, y: 10, enabled: true },
        temperature: { x: 10, y: 45, enabled: true },
        news: { x: 85, y: 45, enabled: true },
        joke: { x: 10, y: 85, enabled: true },
        sports: { x: 85, y: 85, enabled: true }
      },
      centered: {
        clock: { x: 50, y: 30, enabled: true },
        date: { x: 50, y: 20, enabled: true },
        weather: { x: 50, y: 50, enabled: true },
        temperature: { x: 50, y: 60, enabled: true },
        news: { x: 50, y: 70, enabled: true },
        joke: { x: 50, y: 80, enabled: false },
        sports: { x: 50, y: 90, enabled: false }
      }
    };

    const preset = presets[presetName];
    
    if (!preset) {
      return res.status(404).json({ error: `Preset '${presetName}' not found` });
    }

    // Apply preset
    await settingsService.update('layout.widgets', preset);

    // Broadcast layout change
    websocketServer.broadcast({
      type: 'layout_update',
      data: { widgets: preset },
      timestamp: Date.now()
    });

    res.json({
      success: true,
      preset: presetName,
      layout: preset,
      message: `Preset '${presetName}' applied successfully`
    });
  } catch (error) {
    logger.error('Failed to apply preset', { error: error.message });
    res.status(500).json({ error: 'Failed to apply preset' });
  }
});

module.exports = router;
