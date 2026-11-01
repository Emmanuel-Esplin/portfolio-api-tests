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

// Header lines as Playwright prints them in an error's call log, e.g. "  - Authorization: Bearer …".
const HEADER_LINE = /^(\s*-?\s*(?:authorization|cookie|set-cookie|proxy-authorization)\s*:).*$/gim;
const BEARER = /\b(Bearer|token)\s+[A-Za-z0-9._~+/=-]{8,}/g;
const SECRET_QUERY_PARAM = /([?&](?:access_token|token|client_secret|api_key)=)[^&\s"']+/gi;

/** Redacts secrets in free text: error messages, stacks and URLs. */
export function redactText(text: string, secrets: (string | undefined)[] = []): string {
  let out = text
    .replace(HEADER_LINE, `$1 ${REDACTED}`)
    .replace(BEARER, `$1 ${REDACTED}`)
    .replace(SECRET_QUERY_PARAM, `$1${REDACTED}`);
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join(REDACTED);
  }
  return out;
}

/** Redacts sensitive keys, then secrets anywhere in the resulting text. */
export function redact(value: unknown, secrets: (string | undefined)[] = []): string {
  return redactText(JSON.stringify(redactValue(value), null, 2), secrets);
}
