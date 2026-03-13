const ATTEMPTS_PER_WINDOW = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const attemptsByIp = new Map();

function pruneEntry(entry, now) {
  entry.attempts = entry.attempts.filter((attemptTime) => now - attemptTime < WINDOW_MS);
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    entry.lockedUntil = 0;
  }
  return entry;
}

function getEntry(ip) {
  const now = Date.now();
  const entry = attemptsByIp.get(ip) || { attempts: [], lockedUntil: 0 };
  pruneEntry(entry, now);
  attemptsByIp.set(ip, entry);
  return entry;
}

function getLoginRateLimitStatus(ip) {
  const now = Date.now();
  const entry = getEntry(ip);

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
      remainingAttempts: 0,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, ATTEMPTS_PER_WINDOW - entry.attempts.length),
  };
}

function recordFailedLoginAttempt(ip) {
  const now = Date.now();
  const entry = getEntry(ip);
  entry.attempts.push(now);

  if (entry.attempts.length >= ATTEMPTS_PER_WINDOW) {
    entry.lockedUntil = now + LOCKOUT_MS;
    entry.attempts = [];
  }

  attemptsByIp.set(ip, entry);
  return getLoginRateLimitStatus(ip);
}

function recordSuccessfulLogin(ip) {
  attemptsByIp.delete(ip);
}

module.exports = {
  ATTEMPTS_PER_WINDOW,
  LOCKOUT_MS,
  getLoginRateLimitStatus,
  recordFailedLoginAttempt,
  recordSuccessfulLogin,
};
