import { HEAL_LIMITS } from '../clients/healPolicy';
import { RateLimit } from '../schemas/github/rateLimit';
import { handleRateLimited, test as apiTest } from './api';

const MIN_REMAINING = 10;

/** github specs use this test: every test first checks there are calls left. */
export const test = apiTest.extend<{ rateLimitGuard: void }>({
  rateLimitGuard: [
    async ({ github }, use, testInfo) => {
      // /rate_limit does not count against the limit.
      const { rate } = RateLimit.parse(await (await github.rateLimit()).json());
      if (rate.remaining < MIN_REMAINING) {
        const waitMs = Math.max(0, rate.reset * 1000 - Date.now());
        if (waitMs > HEAL_LIMITS.maxWaitMs) {
          handleRateLimited(testInfo, {
            request: 'rate-limit guard',
            trigger: `only ${rate.remaining} calls left`,
            waitMs,
            resetAt: new Date(rate.reset * 1000),
          });
        }
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
