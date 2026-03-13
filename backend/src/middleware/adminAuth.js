const { verifyToken } = require('../utils/auth');
const logger = require('../utils/logger');

function extractToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const headerToken = req.headers['x-auth-token'] || req.headers['X-Auth-Token'];
  if (headerToken) {
    return headerToken;
  }
  const queryToken = req.query?.authToken;
  if (queryToken) {
    return queryToken;
  }
  return null;
}

function adminAuth(req, res, next) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    // If no admin password is configured, treat as no admin auth
    return next();
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    logger.warn('Invalid admin token', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }

  req.admin = { username: payload.username || 'admin' };
  next();
}

module.exports = adminAuth;
