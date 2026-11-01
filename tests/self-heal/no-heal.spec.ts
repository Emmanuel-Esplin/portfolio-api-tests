import { expect, test } from '../../fixtures/selfHeal';

test('404, 422 and a 503 on an unsafe POST are never retried', async ({ stub, stubClient, healEvents }) => {
  stub.script('GET', '/missing', [{ status: 404 }]);
  stub.script('POST', '/markdown', [{ status: 422 }]);
  stub.script('POST', '/orders', [{ status: 503 }]);
  const client = stubClient({ mode: 'report' });

  expect((await client.get('/missing')).status()).toBe(404);
  expect((await client.post('/markdown', { data: {} })).status()).toBe(422);
  expect((await client.post('/orders', { data: {} })).status()).toBe(503);

  expect(stub.received.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /missing', 'POST /markdown', 'POST /orders']);
  expect(healEvents).toEqual([]);
});
