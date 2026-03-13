const { extractAdminToken } = require('../utils/requestAuth');
const { verifyAdminSessionToken } = require('../utils/adminSessions');

function extractApiKey(req) {
  return req.headers['x-api-key'] || req.headers['X-API-Key'] || null;
}

function adminOrApiKey(req, res, next) {
  const apiKey = process.env.API_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!apiKey || !adminPassword) {
    return res.status(503).json({ error: 'Server authentication is not configured correctly' });
  }

  const token = extractAdminToken(req);
  if (token) {
    try {
      const payload = verifyAdminSessionToken(token);
      if (payload?.role === 'admin') {
        req.admin = { username: payload.username || 'admin' };
        return next();
      }
    } catch (_) {
      // Fall through to API key authentication.
    }
  }

  if (extractApiKey(req) === apiKey) {
    req.service = { authenticated: true };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = adminOrApiKey;
