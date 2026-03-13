const SENSITIVE_KEY_PATTERNS = [/token/i, /secret/i, /password/i, /api.?key/i, /authorization/i];

function isSensitiveKey(key) {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key)));
}

function redactSensitive(value, parentKey = '') {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, parentKey));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveKey(key) || isSensitiveKey(parentKey)) {
      redacted[key] = nestedValue == null ? nestedValue : '[REDACTED]';
    } else {
      redacted[key] = redactSensitive(nestedValue, key);
    }
  }

  return redacted;
}

module.exports = {
  isSensitiveKey,
  redactSensitive,
};
