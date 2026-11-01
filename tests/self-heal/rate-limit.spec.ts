import { RateLimitedError, rateLimitOutcome } from '../../clients/healPolicy';
import { expect, test } from '../../fixtures/selfHeal';

test('a short Retry-After is waited out', async ({ stub, stubClient, healEvents }) => {
  stub.script('GET', '/limited', [{ status: 429, headers: { 'retry-after': '1' } }, { status: 200 }]);

  const started = Date.now();
  const response = await stubClient({ mode: 'report' }).get('/limited');

  expect(response.status()).toBe(200);
  expect(Date.now() - started).toBeGreaterThanOrEqual(1000);
  expect(healEvents[0]).toMatchObject({ triggers: ['429 rate limit'], waitedMs: 1000 });
});

test('a long Retry-After is not waited out', async ({ stub, stubClient, rateLimits }) => {
  stub.script('GET', '/limited', [{ status: 429, headers: { 'retry-after': '120' } }]);

  const started = Date.now();
  await expect(stubClient({ mode: 'report' }).get('/limited')).rejects.toThrow(RateLimitedError);

  expect(Date.now() - started).toBeLessThan(1000);
  expect(rateLimits).toEqual([expect.objectContaining({ request: 'GET /limited', waitMs: 120_000 })]);
  // The api fixture turns this into a skip locally and a failure in CI.
  expect(rateLimitOutcome(false)).toBe('skip');
  expect(rateLimitOutcome(true)).toBe('fail');
});
