const crypto = require('crypto');

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const oauthStates = new Map();

function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, entry] of oauthStates.entries()) {
    if (entry.expiresAt <= now) {
      oauthStates.delete(state);
    }
  }
}

function issueOAuthState(provider, metadata = {}, ttlMs = DEFAULT_TTL_MS) {
  cleanupExpiredStates();
  const state = crypto.randomBytes(24).toString('hex');

  oauthStates.set(state, {
    provider,
    metadata,
    expiresAt: Date.now() + ttlMs,
  });

  return state;
}

function consumeOAuthState(provider, state) {
  if (!state) {
    return null;
  }

  cleanupExpiredStates();
  const entry = oauthStates.get(state);
  if (!entry || entry.provider !== provider) {
    return null;
  }

  oauthStates.delete(state);
  return entry.metadata;
}

module.exports = {
  consumeOAuthState,
  issueOAuthState,
};
