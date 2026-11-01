import { env } from '../../config/env';
import { expect, test } from '../../fixtures/api';

test('plain http redirects permanently to https', async ({ site }) => {
  const response = await site.overHttp('/');

  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(`${env.SITE_BASE_URL}/`);
});
