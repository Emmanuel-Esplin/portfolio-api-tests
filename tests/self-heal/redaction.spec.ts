import { expect, test } from '../../fixtures/selfHeal';
import { redact, redactText } from '../../helpers/redact';

const TOKEN = 'ghp_redactionCheck0000000000000000000000';

test('a network error with a token never exposes it', async ({ stub, stubClient, exchanges }) => {
  stub.script('GET', '/down', [{ reset: true }]);

  const error = await stubClient({ mode: 'report', auth: { token: TOKEN } })
    .get('/down')
    .then(
      () => new Error('expected a network error'),
      (caught: unknown) => caught as Error,
    );

  // Playwright's call log lists the headers; the client must scrub them.
  expect(error.message).toContain('Call log');
  expect(error.message).not.toContain(TOKEN);
  expect(error.stack).not.toContain(TOKEN);
  expect(redact(exchanges)).not.toContain(TOKEN);
});

test('redaction covers headers, bearer values and query params but not keys_url', () => {
  const text = redactText(`  - Authorization: Bearer ${TOKEN}\nGET /x?access_token=abc123&page=2`);
  expect(text).not.toContain(TOKEN);
  expect(text).not.toContain('abc123');
  expect(text).toContain('page=2');
  expect(redact({ keys_url: 'https://api.github.com/keys', client_secret: 's3cret' })).toBe(
    JSON.stringify({ keys_url: 'https://api.github.com/keys', client_secret: '[REDACTED]' }, null, 2),
  );
});
