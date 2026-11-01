import { expect, test } from '../../fixtures/api';
import { noteKnownGap } from '../../helpers/knownGap';

// GitHub Pages does not allow custom response headers, so these cannot be added.
const KNOWN_GAPS = [
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
];

test('HSTS is sent and missing headers are recorded as known gaps', async ({ site }) => {
  const response = await site.page('/');
  const headers = response.headers();

  expect(response.status()).toBe(200);
  const maxAge = Number(/max-age=(\d+)/.exec(headers['strict-transport-security'] ?? '')?.[1]);
  expect(maxAge, 'HSTS max-age of at least a year').toBeGreaterThanOrEqual(31_536_000);
  for (const name of KNOWN_GAPS) noteKnownGap(name in headers, `${name} is not sent (GitHub Pages limit)`);
});
