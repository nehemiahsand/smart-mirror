const adminOrApiKey = require('../src/middleware/adminOrApiKey');
const requestAuth = require('../src/utils/requestAuth');
const adminSessions = require('../src/utils/adminSessions');

jest.mock('../src/utils/requestAuth');
jest.mock('../src/utils/adminSessions');

describe('Admin Or API Key Security Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      path: '/api/hybrid-secure',
      ip: '192.168.1.100'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    delete process.env.API_KEY;
    delete process.env.ADMIN_PASSWORD;
    jest.clearAllMocks();
  });

  it('should block requests and return 503 if API_KEY is missing', () => {
    process.env.ADMIN_PASSWORD = 'password';
    adminOrApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('should block requests and return 503 if ADMIN_PASSWORD is missing', () => {
    process.env.API_KEY = 'secret';
    adminOrApiKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('should allow requests if admin token is valid', () => {
    process.env.ADMIN_PASSWORD = 'password';
    process.env.API_KEY = 'secret';
    requestAuth.extractAdminToken.mockReturnValue('valid-admin-token');
    adminSessions.verifyAdminSessionToken.mockReturnValue({ role: 'admin', username: 'admin' });

    adminOrApiKey(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.admin).toBeDefined();
    expect(req.admin.username).toBe('admin');
  });

  it('should fallback and allow if admin fails but api key is valid', () => {
    process.env.ADMIN_PASSWORD = 'password';
    process.env.API_KEY = 'secret';
    requestAuth.extractAdminToken.mockReturnValue('invalid-admin-token');
    adminSessions.verifyAdminSessionToken.mockImplementation(() => { throw new Error('invalid') });
    req.headers['x-api-key'] = 'secret';

    adminOrApiKey(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.service.authenticated).toBe(true);
  });

  it('should block and return 401 if both admin token and api key are invalid/missing', () => {
    process.env.ADMIN_PASSWORD = 'password';
    process.env.API_KEY = 'secret';
    requestAuth.extractAdminToken.mockReturnValue(null);
    req.headers['x-api-key'] = 'wrong-key';

    adminOrApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });
});
