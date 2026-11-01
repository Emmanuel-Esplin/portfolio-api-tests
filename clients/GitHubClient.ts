import type { APIResponse } from '@playwright/test';
import type { MarkdownRequest } from '../payloads/markdown';
import type { RepoQueryParams } from '../payloads/repoQuery';
import { BaseClient } from './BaseClient';

export class GitHubClient extends BaseClient {
  getUser(user: string): Promise<APIResponse> {
    return this.get(`/users/${encodeURIComponent(user)}`);
  }

  listRepos(user: string, query: RepoQueryParams): Promise<APIResponse> {
    return this.get(`/users/${encodeURIComponent(user)}/repos`, { params: query });
  }

  renderMarkdown(body: MarkdownRequest): Promise<APIResponse> {
    return this.postMarkdown(body);
  }

  /** Sends any body, for the negative cases the typed builder cannot produce. */
  renderMarkdownUnchecked(body: Record<string, unknown>): Promise<APIResponse> {
    return this.postMarkdown(body);
  }

  rateLimit(): Promise<APIResponse> {
    return this.get('/rate_limit');
  }

  private postMarkdown(body: unknown): Promise<APIResponse> {
    return this.post('/markdown', { data: body, headers: { 'Content-Type': 'application/json' } });
  }
}
