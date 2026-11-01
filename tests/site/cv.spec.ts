import { expect, test } from '../../fixtures/api';

test('cv page is HTML after its trailing-slash redirect', { tag: '@smoke' }, async ({ site }) => {
  const response = await site.page('/cv');

  expect(response.status()).toBe(200);
  expect(new URL(response.url()).pathname).toBe('/cv/');
  expect(response.headers()['content-type']).toContain('text/html');
});
