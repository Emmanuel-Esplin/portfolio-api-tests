import { env } from '../../config/env';
import { PORTFOLIO } from '../../config/portfolio';
import { expect, test } from '../../fixtures/github';
import { expectSchema } from '../../helpers/expectSchema';
import { buildRepoQuery } from '../../payloads/repoQuery';
import { GitHubRepoList } from '../../schemas/github/repo';

test('the repo list matches the schema and holds every portfolio repo', { tag: '@smoke' }, async ({ github }) => {
  const response = await github.listRepos(env.GITHUB_USER, buildRepoQuery());

  expect(response.status()).toBe(200);
  const repos = await expectSchema(response, GitHubRepoList);
  expect(repos.map((repo) => repo.name)).toEqual(expect.arrayContaining([...PORTFOLIO.repos]));
});

test('per_page=1 returns one repo and a Link header for paging', async ({ github }) => {
  const response = await github.listRepos(env.GITHUB_USER, buildRepoQuery({ per_page: 1 }));

  expect(response.status()).toBe(200);
  expect(await expectSchema(response, GitHubRepoList)).toHaveLength(1);
  expect(response.headers().link).toMatch(/rel="next"/);
});
