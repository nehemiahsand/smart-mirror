const fs = require('fs');
const os = require('os');
const path = require('path');
const tls = require('tls');
const { execFileSync } = require('child_process');
const mqtt = require('mqtt');
const aedes = require('aedes');
const mqttConfig = require('../src/utils/mqttConfig');

describe('MQTT TLS trust and authentication', () => {
  let directory;
  let server;
  let broker;
  let port;
  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-tls-'));
    execFileSync(
      'python3',
      [
        path.join(__dirname, '../../scripts/provision-mqtt.py'),
        '--directory',
        directory,
        '--backend-user',
        'test-backend',
      ],
      { stdio: 'pipe' },
    );
    broker = aedes();
    broker.authenticate = (client, username, password, callback) =>
      callback(
        null,
        username === 'test-backend' && password?.toString() === 'test-password',
      );
    server = tls.createServer(
      {
        key: fs.readFileSync(path.join(directory, 'certs/server.key')),
        cert: fs.readFileSync(path.join(directory, 'certs/server.pem')),
      },
      broker.handle,
    );
    server.on('tlsClientError', () => {});
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  }, 30000);
  afterAll(async () => {
    if (broker) await new Promise((resolve) => broker.close(resolve));
    if (server) await new Promise((resolve) => server.close(resolve));
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  });
  function connect(overrides = {}) {
    const config = mqttConfig({
      MQTT_BROKER_URL: `mqtts://nehemiah-pi5:${port}`,
      MQTT_CA_FILE: path.join(directory, 'certs/ca.pem'),
      MQTT_USERNAME: 'test-backend',
      MQTT_PASSWORD: 'test-password',
    });
    return new Promise((resolve) => {
      const client = mqtt.connect(overrides.url || config.url, {
        ...config.options,
        reconnectPeriod: 0,
        connectTimeout: 2500,
        lookup: (_host, options, callback) =>
          options.all
            ? callback(null, [{ address: '127.0.0.1', family: 4 }])
            : callback(null, '127.0.0.1', 4),
        ...overrides,
      });
      const timer = setTimeout(() => {
        client.end(true);
        resolve('timeout');
      }, 4000);
      client.on('connect', () => {
        clearTimeout(timer);
        client.end(true);
        resolve('connected');
      });
      client.on('error', (error) => {
        clearTimeout(timer);
        client.end(true);
        resolve(error.code || error.message);
      });
    });
  }
  it('accepts the private CA, SAN-matching hostname, and valid password', async () =>
    expect(await connect()).toBe('connected'));
  it('rejects a SAN mismatch without disabling hostname verification', async () =>
    expect(await connect({ url: `mqtts://wrong-host:${port}` })).not.toBe(
      'connected',
    ));
  it('rejects an untrusted CA', async () =>
    expect(await connect({ ca: undefined })).not.toBe('connected'));
  it('retains password authentication in addition to TLS', async () =>
    expect(await connect({ password: 'wrong-password' })).not.toBe(
      'connected',
    ));
  it('generates explicit device ACLs without mounting the CA private key', () => {
    const acl = fs.readFileSync(path.join(directory, 'acl.local'), 'utf8');
    expect(acl).toContain(
      'user mac\ntopic read smartmirror/devices/mac/command',
    );
    expect(acl).toContain('topic write smartmirror/esp32/smart-clock/state');
    const compose = fs.readFileSync(
      path.join(__dirname, '../../docker-compose.yml'),
      'utf8',
    );
    expect(compose).not.toContain('ca.key:');
    expect(compose).not.toContain('1883:1883');
    expect(fs.statSync(path.join(directory, 'certs/ca.key')).mode & 0o777).toBe(
      0o600,
    );
  });
});
