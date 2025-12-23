/**
 * REST API Routes
 */

const express = require('express');
const multer = require('multer');
const logger = require('../utils/logger');
const settingsService = require('../services/settings');
const weatherService = require('../services/weather');
const photosService = require('../services/photos');
const wifiService = require('../services/wifi');
const dht22Service = require('../sensors/dht22');
const googleCalendarService = require('../services/googleCalendar');
const powerService = require('../services/power');
const displayService = require('../services/display');
const cameraService = require('../services/camera');
const trafficService = require('../services/traffic');
const nbaService = require('../services/nba');
const sportsService = require('../services/sports');
const websocketServer = require('./websocket');
const layoutRoutes = require('./layout-routes');

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const router = express.Router();

// Mount layout routes
router.use(layoutRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    wsConnections: websocketServer.getClientCount()
  });
});

// ===== Power Endpoints =====
router.get('/power/status', async (req, res) => {
  res.json({ available: powerService.isAvailable(), tokenConfigured: true });
});

router.post('/power/reboot', async (req, res) => {
  try {
    if (!powerService.isAvailable()) {
      return res.status(503).json({ error: 'Power service unavailable' });
    }
    // Small delay to let response flush before reboot
    setTimeout(() => {
      powerService.reboot(true).catch(err => logger.error('Reboot failed', { error: err.message }));
    }, 250);
    res.json({ success: true, action: 'reboot' });
  } catch (error) {
    logger.error('Failed to reboot', { error: error.message });
    res.status(500).json({ error: 'Failed to reboot' });
  }
});

router.post('/power/shutdown', async (req, res) => {
  try {
    if (!powerService.isAvailable()) {
      return res.status(503).json({ error: 'Power service unavailable' });
    }
    setTimeout(() => {
      powerService.shutdown(true).catch(err => logger.error('Shutdown failed', { error: err.message }));
    }, 250);
    res.json({ success: true, action: 'shutdown' });
  } catch (error) {
    logger.error('Failed to shutdown', { error: error.message });
    res.status(500).json({ error: 'Failed to shutdown' });
  }
});

router.post('/display/refresh', (req, res) => {
  try {
    // Notify all connected WebSocket clients to refresh
    const wss = req.app.get('websocket');
    if (wss) {
      wss.broadcast({ type: 'display_refresh', timestamp: Date.now() });
      logger.info('Display refresh triggered');
      res.json({ success: true, action: 'refresh' });
    } else {
      res.status(503).json({ error: 'WebSocket not available' });
    }
  } catch (error) {
    logger.error('Failed to trigger refresh', { error: error.message });
    res.status(500).json({ error: 'Failed to refresh display' });
  }
});

// ===== Camera / Person Detection Endpoints =====
router.get('/camera/status', async (req, res) => {
  try {
    const status = await cameraService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get camera status', { error: error.message });
    res.status(500).json({ error: 'Failed to get camera status' });
  }
});

router.get('/camera/raw', async (req, res) => {
  try {
    const http = require('http');
    const CAMERA_URL = process.env.CAMERA_URL || 'http://127.0.0.1:5556';
    
    // Parse the URL
    const url = new URL(`${CAMERA_URL}/video/raw`);
    
    // Make HTTP request to camera service
    const options = {
      hostname: url.hostname,
      port: url.port || 5556,
      path: url.pathname,
      method: 'GET'
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
      // Forward headers
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'multipart/x-mixed-replace; boundary=frame');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Pipe the camera stream to the response
      proxyRes.pipe(res);
      
      proxyRes.on('error', (err) => {
        logger.error('Camera raw feed proxy error', { error: err.message });
        res.end();
      });
    });
    
    proxyReq.on('error', (err) => {
      logger.error('Failed to connect to camera service for raw feed', { error: err.message });
      res.status(500).json({ error: 'Camera raw feed unavailable' });
    });
    
    proxyReq.end();
    
    // Handle client disconnect
    req.on('close', () => {
      proxyReq.destroy();
    });
  } catch (error) {
    logger.error('Failed to get camera raw feed', { error: error.message });
    res.status(500).json({ error: 'Camera raw feed unavailable' });
  }
});

router.post('/camera/auto-standby', async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    cameraService.setAutoStandby(enabled);
    res.json({ success: true, auto_standby_enabled: enabled });
  } catch (error) {
    logger.error('Failed to set auto-standby', { error: error.message });
    res.status(500).json({ error: 'Failed to set auto-standby' });
  }
});

router.post('/display/power', async (req, res) => {
  try {
    const { state } = req.body;
    if (!state || !['on', 'off'].includes(state)) {
      return res.status(400).json({ error: 'Invalid state. Use "on" or "off"' });
    }

    const result = state === 'off' ? await displayService.turnOff() : await displayService.turnOn();
    if (result.success) {
      logger.info(`Display power ${state}`);
      res.json({ success: true, state });
    } else {
      res.status(500).json({ error: 'Failed to set display power' });
    }
  } catch (error) {
    logger.error('Failed to set display power', { error: error.message });
    res.status(500).json({ error: 'Failed to set display power' });
  }
});

// ===== Settings Endpoints =====

// Get all settings
router.get('/settings', (req, res) => {
  try {
    const settings = settingsService.getAll();
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get settings', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// Get specific setting
router.get('/settings/:key', (req, res) => {
  try {
    const value = settingsService.get(req.params.key);
    if (value === undefined) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ key: req.params.key, value });
  } catch (error) {
    logger.error('Failed to get setting', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve setting' });
  }
});

// Update single setting
router.put('/settings/:key', async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    const settings = await settingsService.update(req.params.key, value);
    
    // Broadcast settings update via WebSocket
    websocketServer.broadcastSettingsUpdate(settings);
    
    res.json(settings);
  } catch (error) {
    logger.error('Failed to update setting', { error: error.message });
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Update multiple settings (POST method)
router.post('/settings', async (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    
    const settings = await settingsService.updateMultiple(updates);
    
    // Broadcast settings update via WebSocket
    websocketServer.broadcastSettingsUpdate(settings);
    
    // Handle standby mode changes - turn display on/off
    if (updates['display.standbyMode'] !== undefined) {
      const standbyMode = updates['display.standbyMode'];
      
      // Broadcast standby state change to voice service
      websocketServer.broadcast({
        type: 'standby_change',
        standby: standbyMode,
        timestamp: Date.now()
      });
      
      // Turn display on/off based on standby mode
      try {
        if (standbyMode) {
          await displayService.turnOff();
          // Start 30-minute auto-shutdown timer
          cameraService.startShutdownTimer();
        } else {
          await displayService.turnOn();
          // Cancel auto-shutdown timer when waking manually
          cameraService.cancelShutdownTimer();
        }
      } catch (err) {
        logger.error('Failed to change display state', { error: err.message });
      }
      
      // Restart sensor reading
      const restartSensorReading = req.app.get('restartSensorReading');
      if (restartSensorReading) {
        restartSensorReading();
      }
    }
    
    res.json(settings);
  } catch (error) {
    logger.error('Failed to update settings', { error: error.message });
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Update multiple settings (PUT method)
router.put('/settings', async (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    
    const settings = await settingsService.updateMultiple(updates);
    
    // Broadcast settings update via WebSocket
    websocketServer.broadcastSettingsUpdate(settings);
    
    // Handle standby mode changes - turn display on/off
    if (updates['display.standbyMode'] !== undefined) {
      const standbyMode = updates['display.standbyMode'];
      
      // Broadcast standby state change to voice service
      websocketServer.broadcast({
        type: 'standby_change',
        standby: standbyMode,
        timestamp: Date.now()
      });
      
      // Turn display on/off based on standby mode
      try {
        if (standbyMode) {
          await displayService.turnOff();
          // Start 30-minute auto-shutdown timer
          cameraService.startShutdownTimer();
        } else {
          await displayService.turnOn();
          // Cancel auto-shutdown timer when waking manually
          cameraService.cancelShutdownTimer();
        }
      } catch (err) {
        logger.error('Failed to change display state', { error: err.message });
      }
      
      // Restart sensor reading
      const restartSensorReading = req.app.get('restartSensorReading');
      if (restartSensorReading) {
        restartSensorReading();
      }
    }
    
    res.json(settings);
  } catch (error) {
    logger.error('Failed to update settings', { error: error.message });
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Reset settings to defaults
router.post('/settings/reset', async (req, res) => {
  try {
    const settings = await settingsService.reset();
    websocketServer.broadcastSettingsUpdate(settings);
    res.json(settings);
  } catch (error) {
    logger.error('Failed to reset settings', { error: error.message });
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

// ===== Weather Endpoints =====

// Get current weather (simplified endpoint)
router.get('/weather', async (req, res) => {
  try {
    const settings = settingsService.getAll();
    const { city = settings.weather.city, units = settings.weather.units } = req.query;
    
    const weather = await weatherService.getCurrentWeather(city, units);
    res.json(weather);
  } catch (error) {
    logger.error('Failed to get weather', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get current weather (legacy endpoint)
router.get('/weather/current', async (req, res) => {
  try {
    const settings = settingsService.getAll();
    const { city = settings.weather.city, units = settings.weather.units } = req.query;
    
    const weather = await weatherService.getCurrentWeather(city, units);
    res.json(weather);
  } catch (error) {
    logger.error('Failed to get weather', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get weather forecast
router.get('/weather/forecast', async (req, res) => {
  try {
    const settings = settingsService.getAll();
    const { city = settings.weather.city, units = settings.weather.units } = req.query;
    
    const forecast = await weatherService.getForecast(city, units);
    res.json(forecast);
  } catch (error) {
    logger.error('Failed to get forecast', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Clear weather cache
router.post('/weather/cache/clear', (req, res) => {
  try {
    weatherService.clearCache();
    res.json({ message: 'Weather cache cleared' });
  } catch (error) {
    logger.error('Failed to clear weather cache', { error: error.message });
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// ===== Photos Endpoints =====

// Get photos list
router.get('/photos', async (req, res) => {
  try {
    const result = await photosService.getPhotos();
    res.json(result);
  } catch (error) {
    logger.error('Failed to get photos', { error: error.message });
    res.status(500).json({ error: error.message, photos: [] });
  }
});

// Serve individual photo file
router.get('/photos/image/:filename', async (req, res) => {
  try {
    const photoPath = photosService.getPhotoPath(req.params.filename);
    res.sendFile(photoPath);
  } catch (error) {
    logger.error('Failed to serve photo', { error: error.message });
    res.status(404).json({ error: 'Photo not found' });
  }
});

// Upload new photo
router.post('/photos', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const filename = `${Date.now()}-${req.file.originalname}`;
    const caption = req.body.caption || '';
    
    const photo = await photosService.addPhoto(filename, req.file.buffer, caption);
    res.json(photo);
  } catch (error) {
    logger.error('Failed to upload photo', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Update photo metadata
router.put('/photos/:id', async (req, res) => {
  try {
    const id = parseFloat(req.params.id);
    const updates = {
      caption: req.body.caption,
      order: req.body.order
    };
    
    const photo = await photosService.updatePhoto(id, updates);
    res.json(photo);
  } catch (error) {
    logger.error('Failed to update photo', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Delete photo
router.delete('/photos/:id', async (req, res) => {
  try {
    const id = parseFloat(req.params.id);
    await photosService.deletePhoto(id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete photo', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Reorder photos
router.post('/photos/reorder', async (req, res) => {
  try {
    const { photoIds } = req.body;
    if (!Array.isArray(photoIds)) {
      return res.status(400).json({ error: 'photoIds must be an array' });
    }
    
    await photosService.reorderPhotos(photoIds);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to reorder photos', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ===== WiFi Endpoints =====

// Get current connected network
router.get('/wifi/current', async (req, res) => {
  try {
    const status = await wifiService.getStatus();
    res.json({
      ssid: status.ssid || null,
      ip: status.ip || null,
      signal: status.signal || null,
      connected: status.connected || false
    });
  } catch (error) {
    logger.error('Failed to get current WiFi', { error: error.message });
    res.json({ ssid: null, ip: null, connected: false });
  }
});

// Get WiFi status
router.get('/wifi/status', async (req, res) => {
  try {
    const status = await wifiService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get WiFi status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Check for captive portal
router.get('/wifi/captive-portal', async (req, res) => {
  try {
    const result = await wifiService._detectCaptivePortal();
    res.json(result);
  } catch (error) {
    logger.error('Failed to check captive portal', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Scan for WiFi networks
router.get('/wifi/scan', async (req, res) => {
  try {
    const networks = await wifiService.scanNetworks();
    res.json({ networks, count: networks.length });
  } catch (error) {
    logger.error('Failed to scan WiFi networks', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Connect to WiFi network
router.post('/wifi/connect', async (req, res) => {
  try {
    const { ssid, password } = req.body;
    
    if (!ssid) {
      return res.status(400).json({ error: 'SSID is required' });
    }
    
    const result = await wifiService.connect(ssid, password || '');
    
    // Update settings if connected
    if (result.success) {
      await settingsService.update('network.ssid', ssid);
      await settingsService.update('network.connected', true);
      
      // Schedule a reboot after 5 seconds to allow response to be sent
      // This ensures the system restarts with the new network connection
      logger.info('WiFi connected successfully, scheduling reboot in 5 seconds');
      setTimeout(() => {
        powerService.reboot(true).catch(err => 
          logger.error('Auto-reboot after WiFi connection failed', { error: err.message })
        );
      }, 5000);
      
      // Add reboot notification to the response
      result.rebooting = true;
      result.rebootDelay = 5000;
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to connect to WiFi', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Forget/disconnect from WiFi
router.post('/wifi/forget', async (req, res) => {
  try {
    const { ssid, forgetAll } = req.body || {};
    const result = await wifiService.forgetNetwork(ssid, !!forgetAll);

    if (result.success) {
      await settingsService.update('network.connected', false);
      await settingsService.update('network.ssid', '');
    }

    res.json(result);
  } catch (error) {
    logger.error('Failed to forget WiFi', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Disconnect from WiFi
router.post('/wifi/disconnect', async (req, res) => {
  try {
    const result = await wifiService.disconnect();
    
    if (result.success) {
      await settingsService.update('network.connected', false);
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to disconnect WiFi', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Hotspot status
router.get('/wifi/hotspot/status', async (req, res) => {
  try {
    const status = await wifiService.hotspotStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get hotspot status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Start hotspot
router.post('/wifi/hotspot/start', async (req, res) => {
  try {
    const { ssid, password } = req.body || {};
    const result = await wifiService.startHotspot(ssid, password);
    res.json(result);
  } catch (error) {
    logger.error('Failed to start hotspot', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Stop hotspot
router.post('/wifi/hotspot/stop', async (req, res) => {
  try {
    const result = await wifiService.stopHotspot();
    res.json(result);
  } catch (error) {
    logger.error('Failed to stop hotspot', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ===== Sensor Endpoints =====

// Get current sensor reading (simplified endpoint)
router.get('/sensor', async (req, res) => {
  try {
    // In standby mode, return last cached reading without querying hardware
    const settings = settingsService.getAll();
    if (settings?.display?.standbyMode) {
      const lastReading = dht22Service.getLastReading();
      if (lastReading) {
        res.json(lastReading);
      } else {
        res.json({ error: 'No sensor data available (standby mode)' });
      }
      return;
    }
    
    const reading = await dht22Service.getCurrentReading();
    res.json(reading);
  } catch (error) {
    logger.error('Failed to read sensor', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get current sensor reading (legacy endpoint)
router.get('/sensor/dht22', async (req, res) => {
  try {
    const reading = await dht22Service.read();
    res.json(reading);
  } catch (error) {
    logger.error('Failed to read sensor', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get sensor status
router.get('/sensor/status', (req, res) => {
  try {
    const lastReading = dht22Service.getLastReading();
    const available = dht22Service.isAvailable();
    
    res.json({
      available,
      lastReading,
      gpio: dht22Service.gpioPin
    });
  } catch (error) {
    logger.error('Failed to get sensor status', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ===== Display Endpoints =====

// Display a message on the mirror
router.post('/display/message', async (req, res) => {
  try {
    const { message, duration = 5000, priority = 'normal' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    logger.info('Broadcasting display message', { message, duration, priority });
    
    // Broadcast message via WebSocket
    websocketServer.broadcast({
      type: 'display_message',
      data: {
        message,
        duration,
        priority,
        id: Date.now().toString()
      },
      timestamp: Date.now()
    });
    
    res.json({
      success: true,
      message: 'Message broadcasted successfully',
      recipients: websocketServer.getClientCount(),
      data: { message, duration, priority }
    });
  } catch (error) {
    logger.error('Failed to broadcast message', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ===== Google Calendar Endpoints =====

// Get calendar events
router.get('/calendar/events', async (req, res) => {
  try {
    if (!googleCalendarService.isInitialized()) {
      return res.status(401).json({ error: 'AUTH_NEEDED' });
    }

    const maxResults = parseInt(req.query.maxResults) || 10;
    const daysAhead = parseInt(req.query.daysAhead) || 7;
    
    const events = await googleCalendarService.getEvents(maxResults, daysAhead);
    res.json({ events });
  } catch (error) {
    if (error.message === 'AUTH_NEEDED') {
      return res.status(401).json({ error: 'AUTH_NEEDED' });
    }
    logger.error('Failed to get calendar events', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get auth URL for Google Calendar
router.get('/calendar/auth-url', async (req, res) => {
  try {
    const authUrl = await googleCalendarService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    logger.error('Failed to generate calendar auth URL', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Authorize Google Calendar with code
router.post('/calendar/authorize', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    await googleCalendarService.authorize(code);
    res.json({ success: true, message: 'Calendar authorized successfully' });
  } catch (error) {
    logger.error('Failed to authorize calendar', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Get calendar status
router.get('/calendar/status', (req, res) => {
  res.json({ 
    initialized: googleCalendarService.isInitialized(),
    needsAuth: !googleCalendarService.isInitialized()
  });
});

// Get list of all calendars
router.get('/calendar/list', async (req, res) => {
  try {
    if (!googleCalendarService.isInitialized()) {
      return res.status(401).json({ error: 'AUTH_NEEDED' });
    }
    const calendars = await googleCalendarService.getCalendarList();
    res.json({ calendars });
  } catch (error) {
    logger.error('Failed to get calendar list', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ===== System Endpoints =====

// Get system info
router.get('/system/info', (req, res) => {
  try {
    res.json({
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: {
        total: Math.round(require('os').totalmem() / 1024 / 1024),
        free: Math.round(require('os').freemem() / 1024 / 1024),
        used: Math.round((require('os').totalmem() - require('os').freemem()) / 1024 / 1024)
      },
      uptime: process.uptime(),
      cpus: require('os').cpus().length
    });
  } catch (error) {
    logger.error('Failed to get system info', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ===== Voice Command Broadcast Endpoint =====
router.post('/broadcast', (req, res) => {
  try {
    const { type, page, command, listening } = req.body;
    
    logger.info('Broadcasting voice command:', { type, page, command, listening });
    
    // Broadcast to all connected WebSocket clients
    const payload = {
      type: type || 'voice_command',
      timestamp: Date.now()
    };
    
    // Include optional fields if present
    if (page !== undefined) payload.page = page;
    if (command !== undefined) payload.command = command;
    if (listening !== undefined) payload.listening = listening;
    
    websocketServer.broadcast(payload);
    
    res.json({ success: true, broadcasted: true });
  } catch (error) {
    logger.error('Error broadcasting command:', error);
    res.status(500).json({ error: 'Failed to broadcast command' });
  }
});

// ===== Traffic Endpoints =====
router.get('/traffic/commute', async (req, res) => {
  try {
    const settings = settingsService.getAll();
    
    if (!settings.traffic || !settings.traffic.enabled) {
      return res.status(400).json({ error: 'Traffic widget not configured' });
    }

    const { origin, destination, googleMapsApiKey } = settings.traffic;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination must be configured in settings' });
    }

    if (!googleMapsApiKey) {
      return res.status(400).json({ error: 'Google Maps API key not configured' });
    }

    const data = await trafficService.getCommuteData(origin, destination, googleMapsApiKey);
    res.json(data);
  } catch (error) {
    logger.error('Failed to get traffic data', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/traffic/clear-cache', async (req, res) => {
  try {
    trafficService.clearCache();
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    logger.error('Failed to clear traffic cache', { error: error.message });
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// ============================================================================
// Sports Scores Routes (NBA, NFL, NCAA, MLB, Soccer)
// ============================================================================

// Get list of supported sports
router.get('/sports', async (req, res) => {
  try {
    const sports = sportsService.getSupportedSports();
    res.json(sports);
  } catch (error) {
    logger.error('Failed to get sports list', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch sports list' });
  }
});

// Get scores for a specific sport
router.get('/sports/:sport/scores', async (req, res) => {
  try {
    const sport = req.params.sport;
    const teams = req.query.teams ? req.query.teams.split(',') : null;
    const scores = await sportsService.getScores(sport, teams);
    res.json(scores);
  } catch (error) {
    logger.error(`Failed to get ${req.params.sport} scores`, { error: error.message });
    res.status(500).json({ error: `Failed to fetch ${req.params.sport} scores` });
  }
});

// Clear cache for specific sport or all sports
router.post('/sports/clear-cache', async (req, res) => {
  try {
    const sport = req.body.sport || null;
    sportsService.clearCache(sport);
    res.json({ success: true, message: sport ? `${sport} cache cleared` : 'All caches cleared' });
  } catch (error) {
    logger.error('Failed to clear sports cache', { error: error.message });
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Legacy NBA endpoint for backward compatibility
router.get('/nba/scores', async (req, res) => {
  try {
    const teams = req.query.teams ? req.query.teams.split(',') : null;
    const scores = await sportsService.getScores('nba', teams);
    res.json(scores);
  } catch (error) {
    logger.error('Failed to get NBA scores', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch NBA scores' });
  }
});

router.post('/nba/clear-cache', async (req, res) => {
  try {
    sportsService.clearCache('nba');
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    logger.error('Failed to clear NBA cache', { error: error.message });
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

module.exports = router;
