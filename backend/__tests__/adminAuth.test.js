const adminAuth = require('../src/middleware/adminAuth');
const requestAuth = require('../src/utils/requestAuth');
const adminSessions = require('../src/utils/adminSessions');

jest.mock('../src/utils/requestAuth');
jest.mock('../src/utils/adminSessions');

describe('Admin Authentication Middleware Security', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      path: '/api/admin/settings',
      ip: '192.168.1.100'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    delete process.env.ADMIN_PASSWORD;
    
    // reset mocks
    jest.clearAllMocks();
  });

  it('should block requests and return 503 if ADMIN_PASSWORD is missing', () => {
    adminAuth(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server authentication is not configured correctly' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should block requests and return 401 if token is missing', () => {
    process.env.ADMIN_PASSWORD = 'admin-pass-secure';
    requestAuth.extractAdminToken.mockReturnValue(null);
    
    adminAuth(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should block requests and return 401 if token is invalid or expired', () => {
    process.env.ADMIN_PASSWORD = 'admin-pass-secure';
    requestAuth.extractAdminToken.mockReturnValue('fake-token');
    adminSessions.verifyAdminSessionToken.mockReturnValue(null);
    
    adminAuth(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired admin token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should block requests and return 401 if token payload role is not admin', () => {
    process.env.ADMIN_PASSWORD = 'admin-pass-secure';
    requestAuth.extractAdminToken.mockReturnValue('user-token');
    adminSessions.verifyAdminSessionToken.mockReturnValue({ role: 'user', username: 'testuser' });
    
    adminAuth(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired admin token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow requests and populate req.admin if valid admin token', () => {
    process.env.ADMIN_PASSWORD = 'admin-pass-secure';
    requestAuth.extractAdminToken.mockReturnValue('valid-admin-token');
    adminSessions.verifyAdminSessionToken.mockReturnValue({ role: 'admin', username: 'mirroradmin' });
    
    adminAuth(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(req.admin).toBeDefined();
    expect(req.admin.username).toBe('mirroradmin');
  });
});
