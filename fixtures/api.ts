import { test as base, type TestInfo } from '@playwright/test';
import type { AuthState, ClientOptions, Exchange, HealEvent, RateLimitInfo } from '../clients/BaseClient';
import { GitHubClient } from '../clients/GitHubClient';
import { rateLimitOutcome } from '../clients/healPolicy';
import { SiteClient } from '../clients/SiteClient';
import { env, isCI, type HealMode } from '../config/env';
import { redact } from '../helpers/redact';

export const HEALED = 'healed';

interface ApiFixtures {
  healMode: HealMode;
  exchanges: Exchange[];
  healEvents: HealEvent[];
  site: SiteClient;
  github: GitHubClient;
}

interface WorkerFixtures {
  githubAuth: AuthState;
}

function describeHeal(event: HealEvent): string {
  const summary = `${event.request}: ${event.triggers.join(', ')} (${event.attempts} attempts, waited ${event.waitedMs} ms)`;
  return event.note ? `${summary}. ${event.note}` : summary;
}

/** Records the heal and annotates the test straight away, so teardown order does not matter. */
export function recordHeal(testInfo: TestInfo, events: HealEvent[], event: HealEvent): void {
  events.push(event);
  testInfo.annotations.push({ type: HEALED, description: describeHeal(event) });
}

/** Skips locally and fails in CI, with the reset time in the reason. */
export function handleRateLimited(testInfo: TestInfo, info: RateLimitInfo): never {
  const reason = `${info.request} hit a ${info.trigger}; resets at ${info.resetAt.toISOString()}`;
  if (rateLimitOutcome(isCI) === 'skip') testInfo.skip(true, reason);
  throw new Error(reason);
}

export const test = base.extend<ApiFixtures, WorkerFixtures>({
  healMode: [env.HEAL_MODE, { option: true }],

  githubAuth: [
    async ({}, use) => {
      await use({ token: env.GITHUB_TOKEN });
    },
    { scope: 'worker' },
  ],

  healEvents: async ({}, use) => {
    await use([]);
  },

  exchanges: async ({}, use, testInfo) => {
    const exchanges: Exchange[] = [];
    await use(exchanges);
    const failed = testInfo.status !== testInfo.expectedStatus;
    const healed = testInfo.annotations.some((annotation) => annotation.type === HEALED);
    if ((failed || healed) && exchanges.length > 0) {
      await testInfo.attach('api-exchanges.json', {
        body: redact(exchanges, [env.GITHUB_TOKEN]),
        contentType: 'application/json',
      });
    }
  },

  site: async ({ request, exchanges, healEvents, healMode }, use, testInfo) => {
    const options: ClientOptions = {
      request,
      exchanges,
      mode: healMode,
      onHeal: (event) => recordHeal(testInfo, healEvents, event),
      onRateLimited: (info) => handleRateLimited(testInfo, info),
    };
    await use(new SiteClient(options, env.SITE_BASE_URL));
  },

  github: async ({ request, exchanges, healEvents, healMode, githubAuth }, use, testInfo) => {
    const options: ClientOptions = {
      request,
      exchanges,
      mode: healMode,
      auth: githubAuth,
      onHeal: (event) => recordHeal(testInfo, healEvents, event),
      onRateLimited: (info) => handleRateLimited(testInfo, info),
    };
    await use(new GitHubClient(options));
  },
});

export { expect } from '@playwright/test';
