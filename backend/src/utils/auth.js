const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const TOKEN_ISSUER = 'smart-mirror';
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const TOKEN_AUDIENCES = Object.freeze({
  ADMIN_SESSION: 'admin-session',
  CAMERA_STREAM: 'camera-stream',
});

function getSecret() {
  if (!process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET is required');
  }
  return process.env.AUTH_SECRET;
}

function createToken(payload, expiresInSeconds = DEFAULT_TOKEN_TTL_SECONDS, options = {}) {
  const jwtOptions = {
    algorithm: 'HS256',
    expiresIn: expiresInSeconds,
    issuer: TOKEN_ISSUER,
  };

  if (options.audience) {
    jwtOptions.audience = options.audience;
  }

  if (options.subject) {
    jwtOptions.subject = options.subject;
  }

  if (options.jwtId) {
    jwtOptions.jwtid = options.jwtId;
  }

  return jwt.sign(payload, getSecret(), jwtOptions);
}

function verifyToken(token, options = {}) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const verifyOptions = {
    algorithms: ['HS256'],
    issuer: TOKEN_ISSUER,
  };

  if (options.audience) {
    verifyOptions.audience = options.audience;
  }

  if (options.subject) {
    verifyOptions.subject = options.subject;
  }

  if (options.jwtId) {
    verifyOptions.jwtid = options.jwtId;
  }

  try {
    return jwt.verify(token, getSecret(), verifyOptions);
  } catch (_) {
    return null;
  }
}

function generateTokenId() {
  return crypto.randomUUID();
}

module.exports = {
  createToken,
  DEFAULT_TOKEN_TTL_SECONDS,
  generateTokenId,
  TOKEN_AUDIENCES,
  verifyToken,
};
