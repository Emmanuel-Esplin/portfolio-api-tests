const REDACTED = '[REDACTED]';
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie']);
// Whole names, or names ending in _token etc., so GitHub's keys_url is left alone.
const SENSITIVE_KEY = /(^|_)(token|secret|password|api_key)$/i;

function isSensitive(key: string): boolean {
  return SENSITIVE_HEADERS.has(key.toLowerCase()) || SENSITIVE_KEY.test(key);
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, isSensitive(key) ? REDACTED : redactValue(inner)]),
    );
  }
  if (typeof value === 'string' && /^[[{]/.test(value.trimStart())) {
    // Bodies are stored as text; redact inside them when they are JSON.
    try {
      return JSON.stringify(redactValue(JSON.parse(value)));
    } catch {
      return value;
    }
  }
  return value;
}

/** Redacts sensitive keys, then any literal occurrence of the given secrets. */
export function redact(value: unknown, secrets: (string | undefined)[] = []): string {
  let text = JSON.stringify(redactValue(value), null, 2);
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join(REDACTED);
  }
  return text;
}
