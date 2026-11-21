import { expect, test } from '../../fixtures/api';
import { noteKnownGap } from '../../helpers/knownGap';

// A fixed path, so GitHub's edge can cache the 404. A fresh path per run often
// gets GitHub Pages' "Unicorn!" 503 for several requests before the 404 arrives.
const MISSING_PATH = '/no-such-page-portfolio-api-tests';
const UNICORN_TITLE = '<title>Unicorn! &middot; GitHub';

// That 503 is GitHub Pages behaviour, not a site fault, so this spec waits it out
// itself instead of letting a client heal fail the strict nightly run.
test.use({ healMode: 'off' });

test('an unknown path returns a 404 HTML page', async ({ site }) => {
  let sawUnicorn = false;
  let html = '';
  let contentType = '';

  await expect
    .poll(
      async () => {
        const response = await site.page(MISSING_PATH);
        html = await response.text();
        contentType = response.headers()['content-type'] ?? '';
        if (response.status() === 503 && html.includes(UNICORN_TITLE)) sawUnicorn = true;
        return response.status();
      },
      { message: `GET ${MISSING_PATH} should settle on 404`, intervals: [500, 1000, 2000], timeout: 10_000 },
    )
    .toBe(404);

  expect(contentType).toContain('text/html');
  noteKnownGap(!sawUnicorn, 'GitHub Pages served its "Unicorn!" 503 for an uncached missing path before the 404');
  noteKnownGap(!html.includes('<title>Page not found &middot; GitHub Pages'), 'No custom 404 page; GitHub Pages serves its default one');
});
