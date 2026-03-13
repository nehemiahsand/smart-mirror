const logger = require('../utils/logger');

const HEADER_NAME = 'x-api-key';

function apiKeyMiddleware(req, res, next) {
  const apiKey = process.env.API_KEY;

  // If no API key is configured, do not enforce (development / unsecured mode)
  if (!apiKey) {
    if (!process.env.API_KEY_WARNING_SHOWN) {
      logger.warn('API_KEY is not set – API key protection is disabled');
      process.env.API_KEY_WARNING_SHOWN = '1';
    }
    return next();
  }

  // Allow preflight
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Health endpoint can be public if desired
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }

  const headerKey = req.headers[HEADER_NAME] || req.headers[HEADER_NAME.toUpperCase()];
  const queryKey = req.query?.apiKey;
  const providedKey = headerKey || queryKey;

  if (!providedKey || providedKey !== apiKey) {
    logger.warn('API key missing or invalid', { path: req.path, ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

module.exports = apiKeyMiddleware;
