const logger = require('../utils/logger');

function apiKeyMiddleware(req, res, next) {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    logger.error('API_KEY is required for internal service authentication');
    return res.status(503).json({ error: 'Server authentication is not configured correctly' });
  }

  const providedKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
  if (!providedKey || providedKey !== apiKey) {
    logger.warn('API key missing or invalid', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.service = { authenticated: true };
  return next();
}

module.exports = apiKeyMiddleware;
