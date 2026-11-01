import { expect, test } from '../../fixtures/api';
import { noteKnownGap } from '../../helpers/knownGap';

test('an unknown path returns a 404 HTML page', async ({ site }) => {
  const response = await site.page(`/no-such-page-${Date.now().toString(36)}`);

  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('text/html');
  const html = await response.text();
  noteKnownGap(!html.includes('<title>Page not found &middot; GitHub Pages'), 'No custom 404 page; GitHub Pages serves its default one');
});
