import type { APIRequestContext, APIResponse } from '@playwright/test';

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

export interface ClientOptions {
  request: APIRequestContext;
  /** Shared by every client in a test, so the fixture can attach one log. */
  exchanges: Exchange[];
}

function truncate(text: string): string {
  return text.length > BODY_LIMIT ? `${text.slice(0, BODY_LIMIT)}… [truncated ${text.length - BODY_LIMIT} chars]` : text;
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
    const headers = { ...opts.headers };
    const started = Date.now();
    try {
      const response = await this.options.request.fetch(url, {
        method,
        params: opts.params,
        data: opts.data,
        headers,
        maxRedirects: opts.maxRedirects,
        failOnStatusCode: false,
      });
      await this.record(1, method, url, headers, opts.data, started, response);
      return response;
    } catch (error) {
      await this.record(1, method, url, headers, opts.data, started, undefined, error);
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
      url: response?.url() ?? url,
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
