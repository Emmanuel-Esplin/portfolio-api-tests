import type { APIResponse } from '@playwright/test';
import { BaseClient, type ClientOptions } from './BaseClient';

export class SiteClient extends BaseClient {
  constructor(
    options: ClientOptions,
    private readonly baseURL: string,
  ) {
    super(options);
  }

  page(path: string, opts: { maxRedirects?: number } = {}): Promise<APIResponse> {
    return this.get(path, opts);
  }

  /** Requests the plain-http form of a path without following the redirect. */
  overHttp(path: string): Promise<APIResponse> {
    const url = new URL(path, this.baseURL);
    url.protocol = 'http:';
    return this.get(url.toString(), { maxRedirects: 0 });
  }
}
