const request = require('supertest');
const express = require('express');
const layoutRoutes = require('../src/api/layout-routes');
const settingsService = require('../src/services/settings');
const websocketServer = require('../src/api/websocket');
const adminAuth = require('../src/middleware/adminAuth');

jest.mock('../src/services/settings');
jest.mock('../src/api/websocket');
jest.mock('../src/middleware/adminAuth', () => (req, res, next) => next()); // Mock auth to pass in layout tests

const app = express();
app.use(express.json());
app.use('/api', layoutRoutes);

describe('Layout API Routes (Frontend Critical)', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/layout', () => {
    it('should return 200 with current layout data', async () => {
      const mockSettings = { layout: { widgets: { clock: { x: 50, y: 10 } } } };
      settingsService.getAll.mockReturnValue(mockSettings);

      const response = await request(app).get('/api/layout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSettings.layout);
    });

    it('should return empty object if layout does not exist in settings', async () => {
      settingsService.getAll.mockReturnValue({}); // No layout

      const response = await request(app).get('/api/layout');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ widgets: {} });
    });

    it('should return 500 if settings service throws an error', async () => {
      settingsService.getAll.mockImplementation(() => { throw new Error('DB Error'); });

      const response = await request(app).get('/api/layout');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to retrieve layout');
    });
  });

  describe('POST /api/layout', () => {
    it('should reject requests lacking a widgets object', async () => {
      const response = await request(app)
        .post('/api/layout')
        .send({ badPayload: true });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Widgets configuration is required');
    });

    it('should update settings and broadcast on WebSocket on successful update', async () => {
      const payload = { widgets: { date: { x: 20, y: 60 } } };
      settingsService.getAll.mockReturnValue({ layout: payload });
      settingsService.update.mockResolvedValue();

      const response = await request(app)
        .post('/api/layout')
        .send(payload);

      expect(response.status).toBe(200);
      expect(settingsService.update).toHaveBeenCalledWith('layout.widgets', payload.widgets);
      expect(websocketServer.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'layout_update',
          data: payload
        })
      );
      expect(response.body.success).toBe(true);
      expect(response.body.layout).toEqual(payload);
    });
  });

  describe('POST /api/layout/preset/:presetName', () => {
    it('should apply valid presets and broadcast changes', async () => {
      settingsService.update.mockResolvedValue();

      const response = await request(app).post('/api/layout/preset/centered');

      expect(response.status).toBe(200);
      expect(settingsService.update).toHaveBeenCalledWith(
        'layout.widgets',
        expect.objectContaining({
          clock: expect.objectContaining({ x: 50, y: 30 })
        })
      );
      expect(websocketServer.broadcast).toHaveBeenCalled();
      expect(response.body.success).toBe(true);
      expect(response.body.preset).toBe('centered');
    });

    it('should return 404 for unknown presets', async () => {
      const response = await request(app).post('/api/layout/preset/unknown-preset');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', "Preset 'unknown-preset' not found");
    });
  });
});
