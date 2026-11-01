import { expect, test } from '../../fixtures/selfHeal';

test('503 then 200 heals once and annotates the test', async ({ stub, stubClient, exchanges, healEvents }) => {
  stub.script('GET', '/flaky', [{ status: 503 }, { status: 200, body: { ok: true } }]);

  const response = await stubClient({ mode: 'report' }).get('/flaky');

  expect(response.status()).toBe(200);
  expect(healEvents).toEqual([expect.objectContaining({ request: 'GET /flaky', triggers: ['503'], attempts: 2 })]);
  expect(exchanges.map((e) => [e.attempt, e.status])).toEqual([
    [1, 503],
    [2, 200],
  ]);
  expect(test.info().annotations).toContainEqual(expect.objectContaining({ type: 'healed' }));
});

test('503 three times gives up after three attempts', async ({ stub, stubClient, exchanges, healEvents }) => {
  stub.script('GET', '/down', [{ status: 503 }]);

  const response = await stubClient({ mode: 'report' }).get('/down');

  expect(response.status()).toBe(503);
  expect(exchanges.map((e) => e.attempt)).toEqual([1, 2, 3]);
  expect(healEvents).toEqual([]);
});

test('a connection reset is retried', async ({ stub, stubClient, healEvents }) => {
  stub.script('GET', '/reset', [{ reset: true }, { status: 200 }]);

  const response = await stubClient({ mode: 'report' }).get('/reset');

  expect(response.status()).toBe(200);
  expect(healEvents[0]?.triggers[0]).toMatch(/^network error/);
});
