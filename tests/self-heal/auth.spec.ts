import { expect, test } from '../../fixtures/selfHeal';

test('a rejected token is dropped and the request retried without it', async ({ stub, stubClient, healEvents }) => {
  stub.script('GET', '/user', [{ status: 401, body: { message: 'Bad credentials' } }, { status: 200 }]);
  const auth = { token: 'expired-token' };

  const response = await stubClient({ mode: 'report', auth }).get('/user');

  expect(response.status()).toBe(200);
  const [first, second] = stub.requestsTo('GET', '/user');
  expect(first?.headers.authorization).toBe('Bearer expired-token');
  expect(second?.headers.authorization).toBeUndefined();
  expect(auth.token).toBeUndefined();
  expect(healEvents[0]?.note).toContain('Rotate the token');
});
