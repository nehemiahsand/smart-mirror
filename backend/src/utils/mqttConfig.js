const fs = require('fs');
const serviceError = require('./serviceError');

function mqttConfig(env = process.env) {
  const url = env.MQTT_BROKER_URL || env.MQTT_URL || 'mqtts://mosquitto:8883';
  const parsed = new URL(url);
  if (parsed.protocol !== 'mqtts:' || parsed.username || parsed.password)
    throw serviceError('mqtt_tls_required', 503);
  if (!env.MQTT_CA_FILE || !env.MQTT_USERNAME || !env.MQTT_PASSWORD)
    throw serviceError('mqtt_credentials_not_configured', 503);
  return {
    url,
    options: {
      ca: fs.readFileSync(env.MQTT_CA_FILE),
      username: env.MQTT_USERNAME,
      password: env.MQTT_PASSWORD,
      rejectUnauthorized: true,
      reconnectPeriod: 5000,
      clean: true,
      queueQoSZero: false,
    },
  };
}
module.exports = mqttConfig;
