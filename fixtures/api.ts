import { test as base } from '@playwright/test';
import type { Exchange } from '../clients/BaseClient';
import { GitHubClient } from '../clients/GitHubClient';
import { SiteClient } from '../clients/SiteClient';
import { env } from '../config/env';
import { redact } from '../helpers/redact';

interface ApiFixtures {
  exchanges: Exchange[];
  site: SiteClient;
  github: GitHubClient;
}

export const test = base.extend<ApiFixtures>({
  exchanges: async ({}, use, testInfo) => {
    const exchanges: Exchange[] = [];
    await use(exchanges);
    if (testInfo.status !== testInfo.expectedStatus && exchanges.length > 0) {
      await testInfo.attach('api-exchanges.json', {
        body: redact(exchanges, [env.GITHUB_TOKEN]),
        contentType: 'application/json',
      });
    }
  },

  site: async ({ request, exchanges }, use) => {
    await use(new SiteClient({ request, exchanges }, env.SITE_BASE_URL));
  },

  github: async ({ request, exchanges }, use) => {
    await use(new GitHubClient({ request, exchanges }));
  },
});

export { expect } from '@playwright/test';
