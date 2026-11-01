import type { HealMode } from '../config/env';

export const HEAL_LIMITS = {
  /** Extra attempts for network errors and 502/503/504. */
  maxTransientRetries: 2,
  backoffMs: [500, 1000],
  jitterMs: 100,
  /** Rate-limit waits allowed per request. */
  maxRateLimitRetries: 1,
  /** Total time one request may spend waiting to heal. */
  maxWaitMs: 10_000,
} as const;

/** Non-idempotent-looking requests that are safe to send twice. */
const SAFE_NON_GET = new Set(['POST /markdown']);
const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const NETWORK_ERROR = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EPIPE|socket hang up/;

export interface AttemptOutcome {
  method: string;
  /** URL pathname, used for the safe-POST allowlist. */
  path: string;
  status?: number;
  headers?: Record<string, string>;
  error?: unknown;
  hasToken: boolean;
  transientRetries: number;
  rateLimitRetries: number;
  waitedMs: number;
  now: number;
}

export type Decision =
  | { action: 'accept' }
  | { action: 'retry'; trigger: string; waitMs: number; kind: 'transient' | 'rate-limit' }
  | { action: 'drop-auth'; trigger: string }
  | { action: 'rate-limited'; trigger: string; waitMs: number; resetAt: Date };

export class HealedInStrictModeError extends Error {
  override name = 'HealedInStrictModeError';
}

export class RateLimitedError extends Error {
  override name = 'RateLimitedError';
}

export function isRetryable(method: string, path: string): boolean {
  const verb = method.toUpperCase();
  return verb === 'GET' || verb === 'HEAD' || SAFE_NON_GET.has(`${verb} ${path}`);
}

export function networkErrorCode(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : '';
  return NETWORK_ERROR.exec(message)?.[0];
}

function isRateLimited(status: number, headers: Record<string, string>): boolean {
  return status === 429 || (status === 403 && (headers['x-ratelimit-remaining'] === '0' || 'retry-after' in headers));
}

/** How long GitHub asks us to wait, from Retry-After or x-ratelimit-reset. */
export function rateLimitWaitMs(headers: Record<string, string>, now: number): number {
  const retryAfter = Number(headers['retry-after']);
  if (headers['retry-after'] !== undefined && Number.isFinite(retryAfter)) return retryAfter * 1000;
  const reset = Number(headers['x-ratelimit-reset']);
  if (Number.isFinite(reset) && reset > 0) return Math.max(0, reset * 1000 - now);
  // GitHub's guidance when neither header is present.
  return 60_000;
}

/** Locally a rate limit skips the test; in CI it fails, so a green build never hides it. */
export function rateLimitOutcome(isCI: boolean): 'skip' | 'fail' {
  return isCI ? 'fail' : 'skip';
}

function transientRetry(outcome: AttemptOutcome, trigger: string): Decision {
  if (!isRetryable(outcome.method, outcome.path)) return { action: 'accept' };
  if (outcome.transientRetries >= HEAL_LIMITS.maxTransientRetries) return { action: 'accept' };
  const base = HEAL_LIMITS.backoffMs[outcome.transientRetries] ?? HEAL_LIMITS.maxWaitMs;
  const waitMs = base + Math.floor(Math.random() * HEAL_LIMITS.jitterMs);
  if (outcome.waitedMs + waitMs > HEAL_LIMITS.maxWaitMs) return { action: 'accept' };
  return { action: 'retry', trigger, waitMs, kind: 'transient' };
}

/** Decides what to do after one attempt. Pure, so the rules are easy to read and test. */
export function decide(mode: HealMode, outcome: AttemptOutcome): Decision {
  if (mode === 'off') return { action: 'accept' };

  if (outcome.error !== undefined) {
    const code = networkErrorCode(outcome.error);
    return code ? transientRetry(outcome, `network error ${code}`) : { action: 'accept' };
  }

  const status = outcome.status ?? 0;
  const headers = outcome.headers ?? {};

  if (status === 401 && outcome.hasToken) {
    return { action: 'drop-auth', trigger: '401 with token' };
  }

  if (isRateLimited(status, headers)) {
    // A rate-limited request was rejected unprocessed, so any method may be resent.
    const waitMs = rateLimitWaitMs(headers, outcome.now);
    const trigger = `${status} rate limit`;
    const fitsBudget = outcome.waitedMs + waitMs <= HEAL_LIMITS.maxWaitMs;
    if (outcome.rateLimitRetries < HEAL_LIMITS.maxRateLimitRetries && fitsBudget) {
      return { action: 'retry', trigger, waitMs, kind: 'rate-limit' };
    }
    return { action: 'rate-limited', trigger, waitMs, resetAt: new Date(outcome.now + waitMs) };
  }

  if (TRANSIENT_STATUSES.has(status)) return transientRetry(outcome, String(status));

  return { action: 'accept' };
}
