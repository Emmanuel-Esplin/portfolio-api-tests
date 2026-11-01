import { expect, test } from '../../fixtures/github';
import { expectSchema } from '../../helpers/expectSchema';
import { RateLimit } from '../../schemas/github/rateLimit';

test('rate limit status matches the schema', { tag: '@smoke' }, async ({ github }) => {
  const response = await github.rateLimit();

  expect(response.status()).toBe(200);
  const { rate } = await expectSchema(response, RateLimit);
  expect(rate.limit).toBeGreaterThanOrEqual(60);
  expect(rate.remaining).toBeLessThanOrEqual(rate.limit);
});
