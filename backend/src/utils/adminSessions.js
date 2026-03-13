const fs = require('fs');
const path = require('path');
const { createToken, generateTokenId, TOKEN_AUDIENCES, verifyToken } = require('./auth');

const STORE_PATH = path.join(__dirname, '../../data/admin-sessions.json');

function createEmptyStore() {
  return {
    version: 1,
    sessions: {},
  };
}

function ensureStoreDir() {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
}

function loadStore() {
  ensureStoreDir();

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.sessions !== 'object') {
      return createEmptyStore();
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return createEmptyStore();
    }
    throw error;
  }
}

function saveStore(store) {
  ensureStoreDir();
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2));
  fs.renameSync(tempPath, STORE_PATH);
}

function purgeExpiredSessions(store, now = Date.now()) {
  let changed = false;
  for (const [sessionId, session] of Object.entries(store.sessions)) {
    if (!session || !session.expiresAt || session.expiresAt <= now) {
      delete store.sessions[sessionId];
      changed = true;
    }
  }
  return changed;
}

function readStore() {
  const store = loadStore();
  if (purgeExpiredSessions(store)) {
    saveStore(store);
  }
  return store;
}

function issueAdminSession(username, ttlSeconds) {
  const sessionId = generateTokenId();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const store = createEmptyStore();

  store.sessions[sessionId] = {
    username,
    createdAt: Date.now(),
    expiresAt,
  };

  saveStore(store);

  return {
    token: createToken(
      { role: 'admin', username },
      ttlSeconds,
      {
        audience: TOKEN_AUDIENCES.ADMIN_SESSION,
        subject: username,
        jwtId: sessionId,
      }
    ),
    sessionId,
    expiresAt,
  };
}

function verifyAdminSessionToken(token) {
  const payload = verifyToken(token, { audience: TOKEN_AUDIENCES.ADMIN_SESSION });
  if (!payload || payload.role !== 'admin' || !payload.jti) {
    return null;
  }

  const store = readStore();
  const session = store.sessions[payload.jti];
  if (!session) {
    return null;
  }

  const username = payload.username || payload.sub || 'admin';
  if (session.username !== username) {
    return null;
  }

  return payload;
}

function revokeAdminSessionToken(token) {
  const payload = verifyToken(token, { audience: TOKEN_AUDIENCES.ADMIN_SESSION });
  if (!payload?.jti) {
    return false;
  }

  const store = readStore();
  if (!store.sessions[payload.jti]) {
    return false;
  }

  delete store.sessions[payload.jti];
  saveStore(store);
  return true;
}

module.exports = {
  issueAdminSession,
  revokeAdminSessionToken,
  verifyAdminSessionToken,
};
