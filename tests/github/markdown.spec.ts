import { expect, test } from '../../fixtures/github';
import { expectSchema } from '../../helpers/expectSchema';
import { buildMarkdownRequest } from '../../payloads/markdown';
import { GitHubError } from '../../schemas/github/error';

test('a markdown document renders to HTML with its heading', async ({ github }) => {
  const response = await github.renderMarkdown(buildMarkdownRequest('# Portfolio API tests'));

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/html');
  expect(await response.text()).toMatch(/<h1[^>]*>Portfolio API tests<\/h1>/);
});

test('a body without text is a 422 error, with no heal attempted', async ({ github, healEvents }) => {
  const response = await github.renderMarkdownUnchecked({ mode: 'gfm' });

  expect(response.status()).toBe(422);
  const error = await expectSchema(response, GitHubError);
  expect(error.message).toContain("'text'");
  expect(healEvents).toEqual([]);
});
