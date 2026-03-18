const cameraStreamAuth = require('../src/middleware/cameraStreamAuth');
const authParams = require('../src/utils/auth');
const requestAuth = require('../src/utils/requestAuth');
const adminSessions = require('../src/utils/adminSessions');

jest.mock('../src/utils/auth');
jest.mock('../src/utils/requestAuth');
jest.mock('../src/utils/adminSessions');

describe('Camera Stream Authorization Middleware Security', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      query: {},
      path: '/api/camera/stream',
      ip: '192.168.1.100'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    
    // reset mocks
    jest.clearAllMocks();

    authParams.TOKEN_AUDIENCES = { CAMERA_STREAM: 'camera-stream' };
  });

  it('should block requests if neither admin token nor stream token is present', () => {
    requestAuth.extractAdminToken.mockReturnValue(null);
    req.query.streamToken = undefined;

    cameraStreamAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Camera stream authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow requests if admin token is valid', () => {
    requestAuth.extractAdminToken.mockReturnValue('valid-admin');
    adminSessions.verifyAdminSessionToken.mockReturnValue({ role: 'admin', username: 'stream-admin' });

    cameraStreamAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.admin.username).toBe('stream-admin');
  });

  it('should block requests if admin token fails and no stream token is present', () => {
    requestAuth.extractAdminToken.mockReturnValue('invalid-admin');
    adminSessions.verifyAdminSessionToken.mockImplementation(() => { throw new Error('invalid') });

    cameraStreamAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Camera stream authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow access if fallback to stream token succeeds with correct audience and scope', () => {
    requestAuth.extractAdminToken.mockReturnValue(null);
    req.query.streamToken = 'valid-stream-token';
    authParams.verifyToken.mockReturnValue({ role: 'stream', scope: 'camera_raw' });

    cameraStreamAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(authParams.verifyToken).toHaveBeenCalledWith('valid-stream-token', { audience: 'camera-stream' });
    expect(req.stream.scope).toBe('camera_raw');
  });

  it('should block access if stream token does not have stream role or camera_raw scope', () => {
    requestAuth.extractAdminToken.mockReturnValue(null);
    req.query.streamToken = 'valid-stream-token';
    authParams.verifyToken.mockReturnValue({ role: 'user', scope: 'camera_raw' });

    cameraStreamAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired stream token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should block access if stream token parsing throws an error', () => {
    requestAuth.extractAdminToken.mockReturnValue(null);
    req.query.streamToken = 'bad-token';
    authParams.verifyToken.mockImplementation(() => { throw new Error('Bad Format') });

    cameraStreamAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired stream token' });
    expect(next).not.toHaveBeenCalled();
  });
});
