import { BaseClient, type AuthState, type RateLimitInfo } from '../clients/BaseClient';
import { RateLimitedError } from '../clients/healPolicy';
import type { HealMode } from '../config/env';
import { StubServer } from '../helpers/stubServer';
import { recordHeal, test as apiTest } from './api';

interface StubClientOptions {
  /** Required, so HEAL_MODE in the environment never changes these tests. */
  mode: HealMode;
  auth?: AuthState;
}

interface SelfHealFixtures {
  stub: StubServer;
  rateLimits: RateLimitInfo[];
  stubClient: (options: StubClientOptions) => BaseClient;
}

export const test = apiTest.extend<SelfHealFixtures>({
  stub: async ({}, use) => {
    const stub = new StubServer();
    await stub.start();
    await use(stub);
    await stub.stop();
  },

  rateLimits: async ({}, use) => {
    await use([]);
  },

  stubClient: async ({ playwright, stub, exchanges, healEvents, rateLimits }, use, testInfo) => {
    const request = await playwright.request.newContext({ baseURL: stub.url });
    await use(
      ({ mode, auth }) =>
        new BaseClient({
          request,
          exchanges,
          mode,
          auth,
          onHeal: (event) => recordHeal(testInfo, healEvents, event),
          // Records instead of skipping, so the test can assert on it.
          onRateLimited: (info) => {
            rateLimits.push(info);
            throw new RateLimitedError(`${info.request} rate limited until ${info.resetAt.toISOString()}`);
          },
        }),
    );
    await request.dispose();
  },
});

export { expect } from '@playwright/test';
