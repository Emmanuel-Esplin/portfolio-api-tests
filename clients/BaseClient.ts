import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { HealMode } from '../config/env';
import { redactText } from '../helpers/redact';
import { decide, HealedInStrictModeError, RateLimitedError } from './healPolicy';

const BODY_LIMIT = 10 * 1024;

export interface Exchange {
  attempt: number;
  method: string;
  url: string;
  status: number | null;
  error?: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  durationMs: number;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
  headers?: Record<string, string>;
  maxRedirects?: number;
}

/** Shared by the clients of one worker, so a dropped token stays dropped. */
export interface AuthState {
  token: string | undefined;
}

export interface HealEvent {
  request: string;
  triggers: string[];
  attempts: number;
  waitedMs: number;
  note?: string;
}

export interface RateLimitInfo {
  request: string;
  trigger: string;
  waitMs: number;
  resetAt: Date;
}

export interface ClientOptions {
  request: APIRequestContext;
  /** Shared by every client in a test, so the fixture can attach one log. */
  exchanges: Exchange[];
  mode: HealMode;
  auth?: AuthState;
  onHeal?: (event: HealEvent) => void;
  /** Must throw (fail or skip). Called when a rate limit is too long to wait out. */
  onRateLimited?: (info: RateLimitInfo) => never;
}

function truncate(text: string): string {
  return text.length > BODY_LIMIT ? `${text.slice(0, BODY_LIMIT)}… [truncated ${text.length - BODY_LIMIT} chars]` : text;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Removes credentials from an error before it is logged, rethrown or shown in a report. */
function scrubError(error: unknown, token: string | undefined): unknown {
  if (!(error instanceof Error)) return error;
  error.message = redactText(error.message, [token]);
  if (error.stack) error.stack = redactText(error.stack, [token]);
  return error;
}

function pathOf(url: string): string {
  return new URL(url, 'http://placeholder').pathname;
}

export class BaseClient {
  constructor(protected readonly options: ClientOptions) {}

  get(url: string, opts: RequestOptions = {}): Promise<APIResponse> {
    return this.send('GET', url, opts);
  }

  post(url: string, opts: RequestOptions = {}): Promise<APIResponse> {
    return this.send('POST', url, opts);
  }

  async send(method: string, url: string, opts: RequestOptions = {}): Promise<APIResponse> {
    const label = `${method} ${pathOf(url)}`;
    const triggers: string[] = [];
    const notes: string[] = [];
    let transientRetries = 0;
    let rateLimitRetries = 0;
    let waitedMs = 0;

    for (let attempt = 1; ; attempt++) {
      const auth = this.options.auth;
      const headers = { ...opts.headers, ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}) };
      const started = Date.now();
      let response: APIResponse | undefined;
      let error: unknown;
      try {
        response = await this.options.request.fetch(url, {
          method,
          params: opts.params,
          data: opts.data,
          headers,
          maxRedirects: opts.maxRedirects,
          failOnStatusCode: false,
        });
      } catch (caught) {
        // Playwright's call log lists the request headers, including Authorization.
        error = scrubError(caught, auth?.token);
      }
      await this.record(attempt, method, url, headers, opts.data, started, response, error);

      const decision = decide(this.options.mode, {
        method,
        path: pathOf(url),
        status: response?.status(),
        headers: response?.headers(),
        error,
        hasToken: Boolean(auth?.token),
        transientRetries,
        rateLimitRetries,
        waitedMs,
        now: Date.now(),
      });

      switch (decision.action) {
        case 'retry':
          triggers.push(decision.trigger);
          if (decision.kind === 'transient') transientRetries++;
          else rateLimitRetries++;
          await sleep(decision.waitMs);
          waitedMs += decision.waitMs;
          continue;
        case 'drop-auth':
          triggers.push(decision.trigger);
          notes.push('GITHUB_TOKEN was rejected; continuing without it for this worker. Rotate the token.');
          if (auth) auth.token = undefined;
          continue;
        case 'rate-limited': {
          const info = { request: label, trigger: decision.trigger, waitMs: decision.waitMs, resetAt: decision.resetAt };
          if (this.options.onRateLimited) this.options.onRateLimited(info);
          throw new RateLimitedError(
            `${label} hit a ${decision.trigger}; it resets at ${decision.resetAt.toISOString()}, ` +
              `which is longer than the heal budget allows`,
          );
        }
        case 'accept':
          if (decision.exhausted) {
            // Still failing after every allowed retry: not a heal, the attempts are in the log.
            if (response) return response;
            throw error;
          }
          break;
      }

      if (triggers.length > 0) {
        const event: HealEvent = { request: label, triggers, attempts: attempt, waitedMs };
        if (notes.length > 0) event.note = notes.join(' ');
        this.options.onHeal?.(event);
        if (this.options.mode === 'strict') {
          throw new HealedInStrictModeError(
            `Healed in strict mode: ${label} needed ${triggers.join(', ')} (${attempt} attempts, waited ${waitedMs} ms)`,
          );
        }
      }
      if (response) return response;
      throw error;
    }
  }

  protected async record(
    attempt: number,
    method: string,
    url: string,
    requestHeaders: Record<string, string>,
    data: unknown,
    started: number,
    response?: APIResponse,
    error?: unknown,
  ): Promise<void> {
    const exchange: Exchange = {
      attempt,
      method,
      url: redactText(response?.url() ?? url),
      status: response?.status() ?? null,
      requestHeaders,
      durationMs: Date.now() - started,
    };
    if (data !== undefined) exchange.requestBody = truncate(typeof data === 'string' ? data : JSON.stringify(data));
    if (response) {
      exchange.responseHeaders = response.headers();
      exchange.responseBody = truncate(await response.text().catch(() => '<unreadable body>'));
    }
    if (error) exchange.error = error instanceof Error ? error.message : JSON.stringify(error);
    this.options.exchanges.push(exchange);
  }
}
