const apiKeyMiddleware = require('../src/middleware/apiKey');

describe('API Key Middleware Security', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      path: '/api/secure-endpoint',
      ip: '192.168.1.100'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    // Clear env vars
    delete process.env.API_KEY;
  });

  it('should block requests and return 503 if server API_KEY is missing from environment', () => {
    apiKeyMiddleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server authentication is not configured correctly' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should block requests and return 401 if header is missing', () => {
    process.env.API_KEY = 'super-secret-key';
    
    apiKeyMiddleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should block requests and return 401 if header is incorrect', () => {
    process.env.API_KEY = 'super-secret-key';
    req.headers['x-api-key'] = 'wrong-key';
    
    apiKeyMiddleware(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow requests and call next() if key is correct (lower case header)', () => {
    process.env.API_KEY = 'super-secret-key';
    req.headers['x-api-key'] = 'super-secret-key';
    
    apiKeyMiddleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(req.service.authenticated).toBe(true);
  });

  it('should allow requests and call next() if key is correct (upper case header)', () => {
    process.env.API_KEY = 'super-secret-key';
    req.headers['X-API-Key'] = 'super-secret-key';
    
    apiKeyMiddleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(req.service.authenticated).toBe(true);
  });
});
