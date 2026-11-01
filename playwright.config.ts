import { defineConfig } from '@playwright/test';
import { env, isCI } from './config/env';

export default defineConfig({
  testDir: './tests',
  forbidOnly: isCI,
  // The client heals transient errors itself, so a test-level retry is the last resort.
  retries: isCI ? 1 : 0,
  // Worker count applies to the whole run; 2 keeps GitHub calls inside rate limits.
  workers: 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'results/junit.xml' }],
  ],
  projects: [
    {
      name: 'site',
      testDir: './tests/site',
      fullyParallel: true,
      timeout: 15_000,
      use: {
        baseURL: env.SITE_BASE_URL,
        extraHTTPHeaders: { Accept: 'text/html' },
      },
    },
    {
      name: 'github-api',
      testDir: './tests/github',
      // Leaves room for the 10 s heal budget inside one test.
      timeout: 30_000,
      use: {
        baseURL: env.GITHUB_API_BASE_URL,
        // Authorization is added per request by the client, so the auth heal can drop it.
        extraHTTPHeaders: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    },
    {
      name: 'self-heal',
      testDir: './tests/self-heal',
      fullyParallel: true,
      timeout: 15_000,
    },
  ],
});
