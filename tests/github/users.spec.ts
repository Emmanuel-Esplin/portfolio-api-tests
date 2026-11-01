import { env } from '../../config/env';
import { expect, test } from '../../fixtures/github';
import { expectSchema } from '../../helpers/expectSchema';
import { GitHubError } from '../../schemas/github/error';
import { GitHubUser } from '../../schemas/github/user';

test('the portfolio user matches the user schema', { tag: '@smoke' }, async ({ github }) => {
  const response = await github.getUser(env.GITHUB_USER);

  expect(response.status()).toBe(200);
  const user = await expectSchema(response, GitHubUser);
  expect(user.login.toLowerCase()).toBe(env.GITHUB_USER.toLowerCase());
});

test('an unknown user is a 404 error body, with no heal attempted', async ({ github, healEvents }) => {
  const response = await github.getUser(`zz-no-such-user-${Date.now().toString(36)}`);

  expect(response.status()).toBe(404);
  const error = await expectSchema(response, GitHubError);
  expect(error.message).toBe('Not Found');
  expect(healEvents).toEqual([]);
});
