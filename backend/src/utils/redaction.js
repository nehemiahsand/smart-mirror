const SENSITIVE_KEY_PATTERNS = [/token/i, /secret/i, /password/i, /api.?key/i, /authorization/i];
const SENSITIVE_PATHS = new Set([
  'traffic.origin',
  'traffic.destination',
  'traffic.destinations'
]);

function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key)));
}

function isSensitivePath(path) {
  return SENSITIVE_PATHS.has(String(path));
}

function redactSensitive(value, parentKey = '', currentPath = '') {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, parentKey, currentPath));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (isSensitiveKey(key) || isSensitiveKey(parentKey) || isSensitivePath(nextPath)) {
      redacted[key] = nestedValue == null ? nestedValue : '[REDACTED]';
    } else {
      redacted[key] = redactSensitive(nestedValue, key, nextPath);
    }
  }

  return redacted;
}

module.exports = {
  isSensitiveKey,
  isSensitivePath,
  redactSensitive,
};
