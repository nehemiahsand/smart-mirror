/**
 * WebSocket server for real-time data push
 * Broadcasts time, sensor data, and weather updates
 * Accepts client commands for theme, layout, and messages
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');
const settingsService = require('../services/settings');
const weatherService = require('../services/weather');
const dht22Service = require('../sensors/dht22');

class WebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Set();
    this.timeInterval = null;
    this.sensorInterval = null;
    this.weatherInterval = null;
    this.heartbeatInterval = null;
    this.commandHandlers = new Map();
    
    // Register command handlers
    this.registerCommandHandlers();
  }

  /**
   * Register handlers for client commands
   */
  registerCommandHandlers() {
    this.commandHandlers.set('set_theme', this.handleSetTheme.bind(this));
    this.commandHandlers.set('change_layout', this.handleChangeLayout.bind(this));
    this.commandHandlers.set('display_message', this.handleDisplayMessage.bind(this));
    this.commandHandlers.set('set_layout', this.handleSetLayout.bind(this));
  }

  initialize(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      logger.info('WebSocket client connected', { ip: clientIp });
      
      this.clients.add(ws);

      // Send initial connection message with current time
      this.send(ws, {
        type: 'connected',
        message: 'WebSocket connection established',
        timestamp: Date.now(),
        serverTime: new Date().toISOString()
      });

      // Send initial weather and sensor data immediately
      this.sendInitialData(ws);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          logger.debug('WebSocket message received', { type: data.type });
          
          // Handle incoming messages
          this.handleMessage(ws, data);
        } catch (error) {
          logger.error('Failed to parse WebSocket message', {
            error: error.message
          });
          this.send(ws, {
            type: 'error',
            message: 'Invalid message format',
            timestamp: Date.now()
          });
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info('WebSocket client disconnected', { ip: clientIp });
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error: error.message, ip: clientIp });
        this.clients.delete(ws);
      });

      // Setup ping/pong for connection health
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });

    // Setup heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.debug('Terminating inactive WebSocket connection');
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds

    // Start automatic broadcasts
    this.startAutoBroadcasts();

    logger.info('WebSocket server initialized with auto-broadcasts');
    
    // Return wss for use in routes
    return this.wss;
  }

  /**
   * Send initial data to newly connected client
   */
  async sendInitialData(ws) {
    try {
      const settingsService = require('../services/settings');
      const weatherService = require('../services/weather');
      const dht22Service = require('../sensors/dht22');
      
      // Send current settings
      const settings = settingsService.getAll();
      this.send(ws, {
        type: 'settings_update',
        data: settings,
        timestamp: Date.now()
      });

      // Only send initial data if not in standby mode
      if (!settings?.display?.standbyMode) {
        // Send current weather
        try {
          const weather = await weatherService.getCurrentWeather(
            settings.weather.city,
            settings.weather.units
          );
          if (!weather.error) {
            this.send(ws, {
              type: 'weather_data',
              data: weather,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          logger.debug('Could not send initial weather data', { error: error.message });
        }

        // Send current sensor data
        try {
          const reading = await dht22Service.getCurrentReading();
          if (!reading.error) {
            this.send(ws, {
              type: 'sensor_data',
              data: reading,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          logger.debug('Could not send initial sensor data', { error: error.message });
        }

        // Send current time
        const now = new Date();
        this.send(ws, {
          type: 'time',
          data: {
            iso: now.toISOString(),
            timestamp: now.getTime(),
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
            hours: now.getHours(),
            minutes: now.getMinutes(),
            seconds: now.getSeconds(),
            day: now.getDay(),
            dayName: now.toLocaleDateString('en-US', { weekday: 'long' }),
            month: now.getMonth(),
            monthName: now.toLocaleDateString('en-US', { month: 'long' }),
            year: now.getFullYear()
          }
        });
      }
    } catch (error) {
      logger.error('Failed to send initial data', { error: error.message });
    }
  }

  /**
   * Start automatic time, sensor, and weather broadcasts
   */
  startAutoBroadcasts() {
    // Broadcast time every 10 seconds (1 second was overkill)
    this.timeInterval = setInterval(() => {
      const settings = settingsService.getAll();
      if (!settings?.display?.standbyMode) {
        this.broadcastTime();
      }
    }, 10000);

    // Broadcast sensor data every 60 seconds (skip in standby mode)
    this.sensorInterval = setInterval(async () => {
      const settings = settingsService.getAll();
      if (!settings?.display?.standbyMode) {
        await this.broadcastCurrentSensor();
      }
    }, 60000);

    // Broadcast weather every 10 minutes (was 5 minutes)
    this.weatherInterval = setInterval(async () => {
      const settings = settingsService.getAll();
      if (!settings?.display?.standbyMode) {
        await this.broadcastCurrentWeather();
      }
    }, 600000);

    // Send initial weather data immediately
    setTimeout(async () => {
      const settings = settingsService.getAll();
      if (!settings?.display?.standbyMode) {
        await this.broadcastCurrentWeather();
      }
    }, 2000);

    logger.info('Auto-broadcasts started', {
      time: '1s',
      sensor: '60s',
      weather: '5min'
    });
  }

  /**
   * Stop automatic broadcasts
   */
  stopAutoBroadcasts() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
    if (this.sensorInterval) {
      clearInterval(this.sensorInterval);
      this.sensorInterval = null;
    }
    if (this.weatherInterval) {
      clearInterval(this.weatherInterval);
      this.weatherInterval = null;
    }
    logger.info('Auto-broadcasts stopped');
  }

  /**
   * Broadcast current time
   */
  broadcastTime() {
    const now = new Date();
    this.broadcast({
      type: 'time',
      data: {
        iso: now.toISOString(),
        timestamp: now.getTime(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        day: now.getDay(),
        dayName: now.toLocaleDateString('en-US', { weekday: 'long' }),
        month: now.getMonth(),
        monthName: now.toLocaleDateString('en-US', { month: 'long' }),
        year: now.getFullYear()
      }
    });
  }

  /**
   * Broadcast current sensor data
   */
  async broadcastCurrentSensor() {
    try {
      const dht22Service = require('../sensors/dht22');
      const reading = await dht22Service.getCurrentReading();
      
      if (!reading.error) {
        this.broadcast({
          type: 'sensor_data',
          data: reading,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error('Failed to broadcast sensor data', { error: error.message });
    }
  }

  /**
   * Broadcast current weather data
   */
  async broadcastCurrentWeather() {
    try {
      const weatherService = require('../services/weather');
      const settingsService = require('../services/settings');
      
      const settings = settingsService.getAll();
      const weather = await weatherService.getCurrentWeather(
        settings.weather.city,
        settings.weather.units
      );
      
      if (!weather.error) {
        this.broadcast({
          type: 'weather_data',
          data: weather,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      logger.error('Failed to broadcast weather data', { error: error.message });
    }
  }

  /**
   * Broadcast settings change to all clients (for immediate UI updates)
   */
  broadcastSettingsChange(setting, value) {
    try {
      const settingsService = require('../services/settings');
      const allSettings = settingsService.getAll();
      
      this.broadcast({
        type: 'settings_changed',
        data: {
          setting,
          value,
          allSettings
        },
        timestamp: Date.now()
      });
      
      logger.info('Settings change broadcasted', { setting, value });
    } catch (error) {
      logger.error('Failed to broadcast settings change', { error: error.message });
    }
  }

  /**
   * Handle incoming messages from clients
   */
  handleMessage(ws, data) {
    // Handle different message types
    switch (data.type) {
      case 'ping':
        this.send(ws, { type: 'pong', timestamp: Date.now() });
        break;
      
      case 'subscribe':
        logger.info('Client subscribed', { topics: data.topics });
        this.send(ws, { 
          type: 'subscribed', 
          topics: data.topics,
          timestamp: Date.now() 
        });
        break;
      
      case 'command':
        this.handleCommand(ws, data);
        break;
      
      default:
        logger.warn('Unknown WebSocket message type', { type: data.type });
        this.send(ws, {
          type: 'error',
          message: `Unknown message type: ${data.type}`,
          timestamp: Date.now()
        });
    }
  }

  /**
   * Handle client commands
   */
  async handleCommand(ws, data) {
    const { command, payload } = data;
    
    if (!command) {
      this.send(ws, {
        type: 'command_error',
        message: 'Command name is required',
        timestamp: Date.now()
      });
      return;
    }

    logger.info('Received command', { command, payload });

    const handler = this.commandHandlers.get(command);
    
    if (handler) {
      try {
        const result = await handler(payload, ws);
        this.send(ws, {
          type: 'command_response',
          command,
          success: true,
          result,
          timestamp: Date.now()
        });
      } catch (error) {
        logger.error('Command execution failed', { 
          command, 
          error: error.message 
        });
        this.send(ws, {
          type: 'command_error',
          command,
          message: error.message,
          timestamp: Date.now()
        });
      }
    } else {
      this.send(ws, {
        type: 'command_error',
        command,
        message: `Unknown command: ${command}`,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Command handler: Set theme
   */
  async handleSetTheme(payload, ws) {
    const { theme } = payload;
    
    if (!theme) {
      throw new Error('Theme name is required');
    }

    logger.info('Setting theme', { theme });

    // Update settings
    const settingsService = require('../services/settings');
    await settingsService.update('display.theme', theme);

    // Broadcast theme change to all clients
    this.broadcast({
      type: 'theme_changed',
      data: { theme },
      timestamp: Date.now()
    });

    return { theme, message: 'Theme updated successfully' };
  }

  /**
   * Command handler: Change layout
   */
  async handleChangeLayout(payload, ws) {
    const { layout } = payload;
    
    if (!layout) {
      throw new Error('Layout name is required');
    }

    logger.info('Changing layout', { layout });

    // Update settings
    const settingsService = require('../services/settings');
    await settingsService.update('display.layout', layout);

    // Broadcast layout change to all clients
    this.broadcast({
      type: 'layout_changed',
      data: { layout },
      timestamp: Date.now()
    });

    return { layout, message: 'Layout updated successfully' };
  }

  /**
   * Command handler: Display message
   */
  async handleDisplayMessage(payload, ws) {
    const { message, duration = 5000, priority = 'normal' } = payload;
    
    if (!message) {
      throw new Error('Message text is required');
    }

    logger.info('Displaying message', { message, duration, priority });

    // Broadcast message to all clients
    this.broadcast({
      type: 'display_message',
      data: {
        message,
        duration,
        priority,
        id: Date.now().toString()
      },
      timestamp: Date.now()
    });

    return { 
      message: 'Message broadcasted successfully',
      recipients: this.clients.size
    };
  }

  /**
   * Command handler: Set widget layout positions
   */
  async handleSetLayout(payload, ws) {
    const { widgets } = payload;
    
    if (!widgets || typeof widgets !== 'object') {
      throw new Error('Widgets configuration is required');
    }

    logger.info('Setting widget layout', { widgets: Object.keys(widgets) });

    // Update settings with new layout
    const settingsService = require('../services/settings');
    await settingsService.update('layout.widgets', widgets);

    // Broadcast layout change to all clients
    this.broadcast({
      type: 'layout_update',
      data: { widgets },
      timestamp: Date.now()
    });

    return { 
      message: 'Layout updated successfully',
      widgets: Object.keys(widgets)
    };
  }

  send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        logger.error('Failed to send WebSocket message', {
          error: error.message
        });
      }
    }
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    let sentCount = 0;

    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          sentCount++;
        } catch (error) {
          logger.error('Failed to broadcast to client', {
            error: error.message
          });
        }
      }
    });

    if (data.type !== 'time') {
      // Don't log time broadcasts to reduce noise
      logger.debug('Broadcast sent', { clients: sentCount, type: data.type });
    }
  }

  /**
   * Legacy method: Broadcast sensor data
   */
  broadcastSensorData(sensorData) {
    this.broadcast({
      type: 'sensor_data',
      data: sensorData,
      timestamp: Date.now()
    });
  }

  /**
   * Legacy method: Broadcast weather data
   */
  broadcastWeatherData(weatherData) {
    this.broadcast({
      type: 'weather_data',
      data: weatherData,
      timestamp: Date.now()
    });
  }

  /**
   * Legacy method: Broadcast settings update
   */
  broadcastSettingsUpdate(settings) {
    this.broadcast({
      type: 'settings_update',
      data: settings,
      timestamp: Date.now()
    });
  }

  getClientCount() {
    return this.clients.size;
  }

  close() {
    // Stop all broadcasts
    this.stopAutoBroadcasts();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((ws) => {
      ws.close();
    });

    if (this.wss) {
      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });
    }
  }
}

module.exports = new WebSocketServer();
