const dht22Service = require('../src/sensors/dht22');

describe('DHT22 Sensor Hardware Abstraction', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clone environment variables before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment after each test
    process.env = originalEnv;
    jest.restoreAllMockers && jest.restoreAllMockers();
  });

  it('should return mocked synthetic data when NODE_ENV is development', async () => {
    // Arrange: Set the environment to development mode
    process.env.NODE_ENV = 'development';

    // Act: Call the sensor
    const reading = await dht22Service.read();

    // Assert: We should get our standardized mock data without throwing an error
    expect(reading).toBeDefined();
    expect(reading.error).toBeUndefined();
    expect(typeof reading.temperatureCelsius).toBe('number');
    expect(typeof reading.temperatureFahrenheit).toBe('number');
    expect(typeof reading.humidity).toBe('number');
    expect(reading.stale).toBe(false);
    expect(reading.mocked).toBe(true); // Hint: Your abstraction should add a 'mocked: true' flag!
  });

  it('should attempt a real HTTP call when in production', async () => {
    // Arrange: Set to production
    process.env.NODE_ENV = 'production';
    // Break the sensor URL so it fails instantly if it actually tries to make a network request
    process.env.SENSOR_URL = 'http://localhost:9999/does-not-exist';

    // Act: Call the sensor
    const reading = await dht22Service.read();

    // Assert: Since there's no real hardware on a 9999 port locally, it should return an error or stale
    // (This proves it tried to reach real hardware instead of returning mock data)
    expect(reading.mocked).toBeUndefined();
    expect(reading.error !== undefined || reading.stale === true).toBeTruthy();
  });
});
