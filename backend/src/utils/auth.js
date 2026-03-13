const crypto = require('crypto');

const DEFAULT_AUTH_SECRET = 'change-me-in-env-AUTH_SECRET';

function getSecret() {
  return process.env.AUTH_SECRET || DEFAULT_AUTH_SECRET;
}

function base64UrlEncode(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64');
}

function createToken(payload, expiresInSeconds = 60 * 60 * 24 * 7) { // default 7 days
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };
  const json = JSON.stringify(fullPayload);
  const payloadB64 = base64UrlEncode(Buffer.from(json, 'utf8'));
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(payloadB64);
  const signature = base64UrlEncode(hmac.digest());
  return `${payloadB64}.${signature}`;
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(payloadB64);
  const expectedSig = base64UrlEncode(hmac.digest());

  if (!timingSafeEqual(signature, expectedSig)) {
    return null;
  }

  try {
    const json = base64UrlDecode(payloadB64).toString('utf8');
    const payload = JSON.parse(json);
    if (payload.exp && typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }
    }
    return payload;
  } catch (err) {
    return null;
  }
}

module.exports = {
  createToken,
  verifyToken,
};
