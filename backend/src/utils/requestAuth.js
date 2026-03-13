const ADMIN_SESSION_COOKIE = 'smart_mirror_admin';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header) {
    return {};
  }

  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      try {
        cookies[key] = decodeURIComponent(value);
      } catch (_) {
        cookies[key] = value;
      }
      return cookies;
    }, {});
}

function extractAdminToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const headerToken = req.headers['x-auth-token'] || req.headers['X-Auth-Token'];
  if (headerToken) {
    return headerToken;
  }

  const cookies = parseCookies(req);
  return cookies[ADMIN_SESSION_COOKIE] || null;
}

function buildSessionCookieOptions(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const isSecure = req.secure || forwardedProto === 'https';

  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure,
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS * 1000,
  };
}

function setAdminSessionCookie(req, res, token) {
  res.cookie(ADMIN_SESSION_COOKIE, token, buildSessionCookieOptions(req));
}

function clearAdminSessionCookie(req, res) {
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    ...buildSessionCookieOptions(req),
    maxAge: undefined,
  });
}

module.exports = {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  buildSessionCookieOptions,
  clearAdminSessionCookie,
  extractAdminToken,
  parseCookies,
  setAdminSessionCookie,
};
