import { PORTFOLIO } from '../../config/portfolio';
import { expect, test } from '../../fixtures/api';

test('home page is HTML with the owner in the title and a canonical URL', { tag: '@smoke' }, async ({ site }) => {
  const response = await site.page('/');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/html');
  const html = await response.text();
  expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toContain(PORTFOLIO.ownerName);
  expect(/<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]).toBe(PORTFOLIO.canonicalUrl);
});
