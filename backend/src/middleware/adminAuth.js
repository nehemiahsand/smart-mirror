const logger = require('../utils/logger');
const { extractAdminToken } = require('../utils/requestAuth');
const { verifyAdminSessionToken } = require('../utils/adminSessions');

function adminAuth(req, res, next) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).json({ error: 'Server authentication is not configured correctly' });
  }

  const token = extractAdminToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const payload = verifyAdminSessionToken(token);
  if (!payload || payload.role !== 'admin') {
    logger.warn('Invalid admin token', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }

  req.admin = { username: payload.username || 'admin' };
  next();
}

module.exports = adminAuth;
