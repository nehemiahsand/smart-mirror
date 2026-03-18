const { redactSensitive } = require('../src/utils/redaction');

describe('Redaction Utility', () => {
    it('should scrub passwords and secrets from an object', () => {
        const payload = {
            username: 'admin',
            ADMIN_PASSWORD: 'supersecretpassword123',
            config: {
                API_KEY: 'abc-def-123',
                MQTT_PASSWORD: 'mqtt_secret_password'
            }
        };

        const cleaned = redactSensitive(payload);

        expect(cleaned.username).toBe('admin');
        expect(cleaned.ADMIN_PASSWORD).toBe('[REDACTED]');
        expect(cleaned.config.API_KEY).toBe('[REDACTED]');
        expect(cleaned.config.MQTT_PASSWORD).toBe('[REDACTED]');
    });
});