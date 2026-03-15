const mqtt = require('mqtt');
const logger = require('../utils/logger');
const settingsService = require('./settings');
const sceneEngine = require('./sceneEngine');

const ALLOWED_EVENT_TYPES = new Set([
  'alarm.dismiss',
  'alarm.snooze',
  'button.long_press',
  'button.press',
  'climate.reading',
  'device.event',
  'device.offline',
  'device.online',
  'display.page.toggle',
  'motion.active',
  'motion.idle',
  'ui.action',
  'ui.adjust',
  'ui.page.open',
]);
const DEVICE_ID_PATTERN = /^[a-z0-9._:-]{1,64}$/i;

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

class Esp32InputService {
  constructor() {
    this.client = null;
  }

  initialize() {
    const config = settingsService.get('esp32') || {};
    if (config.enabled === false || (config.transport && config.transport !== 'mqtt')) {
      logger.info('ESP32 input service disabled in settings', {
        enabled: config.enabled !== false,
        transport: config.transport || 'mqtt',
      });
      return;
    }

    const brokerUrl = process.env.MQTT_BROKER_URL || process.env.MQTT_URL || config.brokerUrl || config.mqttUrl || 'mqtt://mosquitto:1883';
    const username = process.env.MQTT_USERNAME || config.username || config.mqttUsername || undefined;
    const password = process.env.MQTT_PASSWORD || config.password || config.mqttPassword || undefined;
    const topicPrefix = config.topicPrefix || 'smartmirror/esp32';

    try {
      this.client = mqtt.connect(brokerUrl, {
        reconnectPeriod: 5000,
        username,
        password,
      });
    } catch (error) {
      logger.error('Failed to create MQTT client', { error: error.message });
      return;
    }

    this.client.on('connect', () => {
      logger.info('Connected to MQTT broker', { brokerUrl });
      this.client.subscribe(`${topicPrefix}/+/event`);
      this.client.subscribe(`${topicPrefix}/+/status`);
    });

    this.client.on('message', (topic, payloadBuffer) => {
      const event = this.parseMessage(topic, payloadBuffer);
      if (event) {
        sceneEngine.processInputEvent(event, { source: `mqtt:${topic}` }).catch((error) => {
          logger.error('Failed to process MQTT event', {
            error: error.message,
            topic,
            type: event.type,
          });
        });
      }
    });

    this.client.on('reconnect', () => {
      logger.info('Reconnecting to MQTT broker');
    });

    this.client.on('error', (error) => {
      logger.error('MQTT client error', { error: error.message });
    });

    this.client.on('offline', () => {
      logger.warn('MQTT client offline');
    });
  }

  parseMessage(topic, payloadBuffer) {
    try {
      const payloadText = payloadBuffer.toString('utf8').trim();
      const parts = topic.split('/');
      const topicKind = parts[parts.length - 1];
      const deviceId = parts[parts.length - 2] || 'unknown';
      if (!DEVICE_ID_PATTERN.test(deviceId)) {
        logger.warn('Rejected MQTT event with invalid device id', { topic, deviceId });
        return null;
      }

      if (topicKind === 'status') {
        return {
          type: payloadText === 'offline' ? 'device.offline' : 'device.online',
          deviceId,
          source: 'mqtt',
          payload: payloadText ? { raw: payloadText } : {},
        };
      }

      const parsed = payloadText ? JSON.parse(payloadText) : {};
      const eventType = typeof parsed.type === 'string' ? parsed.type.trim() : 'device.event';
      if (!ALLOWED_EVENT_TYPES.has(eventType)) {
        logger.warn('Rejected MQTT event with unsupported type', {
          topic,
          deviceId,
          type: eventType,
        });
        return null;
      }

      const eventPayload = isPlainObject(parsed.payload) ? parsed.payload : {};
      const timestamp = Number(parsed.timestamp);

      return {
        type: eventType,
        deviceId: parsed.deviceId || deviceId,
        timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
        payload: eventPayload,
      };
    } catch (error) {
      logger.error('Failed to parse MQTT event', {
        error: error.message,
        topic,
      });
      return null;
    }
  }

  close() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }
}

module.exports = new Esp32InputService();
