/**
 * Smart Mirror Backend Server
 * Main entry point
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const logger = require('./utils/logger');
const settingsService = require('./services/settings');
const weatherService = require('./services/weather');
const googleCalendarService = require('./services/googleCalendar');
const powerService = require('./services/power');
const cameraService = require('./services/camera');
const dht22Service = require('./sensors/dht22');
const websocketServer = require('./api/websocket');
const apiRoutes = require('./api/routes');
const spotifyRoutes = require('./api/spotify-routes');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// API Routes
app.use('/api', apiRoutes);
app.use('/api/spotify', spotifyRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Smart Mirror Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      settings: '/api/settings',
      weather: '/api/weather/current',
      wifi: '/api/wifi/status',
      sensor: '/api/sensor/dht22',
      system: '/api/system/info'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize services and start server
async function start() {
  try {
    logger.info('Starting Smart Mirror Backend Server...');

    // Initialize settings service
    await settingsService.initialize();
    logger.info('Settings service initialized');

    // Reload Spotify tokens after settings are initialized
    const spotifyService = require('./services/spotify');
    spotifyService.loadTokens();

    // Set OpenWeather API key if provided
    if (process.env.OPENWEATHER_API_KEY) {
      weatherService.setApiKey(process.env.OPENWEATHER_API_KEY);
      logger.info('OpenWeather API key configured');
    } else {
      logger.warn('OPENWEATHER_API_KEY not set - weather features will be limited');
    }

    // Initialize Google Calendar service
    await googleCalendarService.initialize();
    
    // Initialize Power service
    await powerService.initialize();
    logger.info('Power service', { available: powerService.isAvailable() });

    // Initialize Camera service with AI person detection
    await cameraService.initialize();
    logger.info('Camera service initialized');

    if (googleCalendarService.isInitialized()) {
      logger.info('Google Calendar service initialized');
    } else {
      logger.info('Google Calendar not configured - authorization needed');
    }

    // Initialize WebSocket server
    websocketServer.initialize(server);
    
    // Make websocket server available to routes
    app.set('websocket', websocketServer);

    // Start continuous sensor reading (if available and not in standby mode)
    let sensorIntervalId = null;
    if (dht22Service.isAvailable()) {
      const settings = settingsService.getAll();
      const sensorInterval = parseInt(process.env.SENSOR_INTERVAL) || 60000;
      
      const startSensorReading = () => {
        if (sensorIntervalId) {
          clearInterval(sensorIntervalId);
        }
        
        const currentSettings = settingsService.getAll();
        if (!currentSettings?.display?.standbyMode) {
          sensorIntervalId = setInterval(async () => {
            const currentSettings = settingsService.getAll();
            if (!currentSettings?.display?.standbyMode) {
              const reading = await dht22Service.getCurrentReading();
              if (!reading.error) {
                // Reduced logging - only log on websocket broadcast
                websocketServer.broadcastSensorData(reading);
              }
            }
          }, sensorInterval);
          
          logger.info('Continuous sensor reading started', {
            interval: sensorInterval,
            gpio: dht22Service.gpioPin
          });
        } else {
          logger.info('Sensor reading paused (standby mode active)');
        }
      };
      
      // Start initial reading
      startSensorReading();
      
      // Listen for settings changes to start/stop sensor reading
      app.set('restartSensorReading', startSensorReading);
    }

    // Start periodic weather updates
    const weatherUpdateInterval = settingsService.get('weather.updateInterval') || 600000;
    setInterval(async () => {
      try {
        const settings = settingsService.getAll();
        const weather = await weatherService.getCurrentWeather(
          settings.weather.city,
          settings.weather.units
        );
        
        if (!weather.error) {
          websocketServer.broadcastWeatherData(weather);
          // Removed debug log to reduce overhead
        }
      } catch (error) {
        logger.error('Failed to update weather', { error: error.message });
      }
    }, weatherUpdateInterval);

    logger.info('Periodic weather updates configured', {
      interval: weatherUpdateInterval
    });

    // Start HTTP server
    server.listen(PORT, HOST, () => {
      logger.info(`Server listening on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Smart Mirror Backend ready!');
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down gracefully...');
  
  websocketServer.close();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason,
    promise: promise
  });
});

// Start the server
start();
