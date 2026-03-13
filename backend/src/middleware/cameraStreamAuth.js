const { TOKEN_AUDIENCES, verifyToken } = require('../utils/auth');
const { extractAdminToken } = require('../utils/requestAuth');
const { verifyAdminSessionToken } = require('../utils/adminSessions');

function cameraStreamAuth(req, res, next) {
  const adminToken = extractAdminToken(req);
  if (adminToken) {
    try {
      const payload = verifyAdminSessionToken(adminToken);
      if (payload?.role === 'admin') {
        req.admin = { username: payload.username || 'admin' };
        return next();
      }
    } catch (_) {
      // Fall through to stream token validation.
    }
  }

  const streamToken = req.query?.streamToken;
  if (!streamToken) {
    return res.status(401).json({ error: 'Camera stream authentication required' });
  }

  try {
    const payload = verifyToken(streamToken, { audience: TOKEN_AUDIENCES.CAMERA_STREAM });
    if (payload?.role === 'stream' && payload?.scope === 'camera_raw') {
      req.stream = { scope: payload.scope };
      return next();
    }
  } catch (_) {
    // Handled below.
  }

  return res.status(401).json({ error: 'Invalid or expired stream token' });
}

module.exports = cameraStreamAuth;
