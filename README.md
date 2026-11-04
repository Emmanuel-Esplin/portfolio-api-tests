# portfolio-api-tests

Playwright API tests, with no browser, for two HTTP surfaces:

- **Portfolio site** (`https://emmanuel-esplin.github.io`): status codes, content type, routing, 404, HTTPS redirect and security headers.
- **GitHub REST API** (`https://api.github.com`), which feeds the site's project list: user and repo JSON, typed query and POST payloads, error bodies and rate limits.

A bounded self-heal layer absorbs transient network and rate-limit failures. It records every heal it makes, and it is tested on its own against a local stub server.

## Setup

```sh
nvm use          # Node 22 (.nvmrc)
npm ci
cp .env.example .env.local
npm test
```

No `npx playwright install` is needed, because the tests only use `APIRequestContext`.

## Environment

`config/env.ts` loads `.env.<ENV>` (`ENV` defaults to `local`), and real environment variables take priority over it. It then validates everything with zod and stops before any test runs if something is wrong. It names the variable at fault but never prints its value.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `GITHUB_USER` | yes | | The account whose user and repos are tested |
| `GITHUB_TOKEN` | no | | Fine-grained, read-only public access. Without it the suite runs at 60 requests an hour |
| `SITE_BASE_URL` | no | `https://emmanuel-esplin.github.io` | Must be `https://` |
| `GITHUB_API_BASE_URL` | no | `https://api.github.com` | Must be `https://` |
| `HEAL_MODE` | no | `report` | `off`, `report` or `strict` (see below) |

`.env.staging` (used by `npm run test:staging`) should point `SITE_BASE_URL` at a second HTTPS deployment of the site. GitHub Pages has no preview builds of its own.

## Scripts

| Script | What it does |
| --- | --- |
| `npm test` | All three projects: `site`, `github-api`, `self-heal` |
| `npm run test:smoke` | The five `@smoke` tests |
| `npm run test:staging` | All tests with `ENV=staging` |
| `npm run test:strict` | `HEAL_MODE=strict` plus `--fail-on-flaky-tests` |
| `npm run test:debug` | Inspector with healing off, so each request runs once |
| `npm run report` | Opens the HTML report |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` / `eslint .` |

## Self-heal

The heal rules live in `clients/healPolicy.ts` as one pure `decide()` function, and `BaseClient` applies them to every request.

| Trigger | Heal | Limit |
| --- | --- | --- |
| Network error (`ECONNRESET`, `ETIMEDOUT`, DNS failure) | Retry after 500 ms, then 1 s (plus jitter) | 2 extra attempts |
| `502`, `503`, `504` | Same retry | 2 extra attempts |
| `429`, or `403` with `x-ratelimit-remaining: 0` or `Retry-After` | Wait, then retry once | Only if the wait is 10 s or less; otherwise skip locally, fail in CI |
| `401` while a token is set | Drop the token for the rest of the worker and retry | Once per worker |
| Fewer than 10 GitHub calls left (guard before each github test) | Wait for the reset | Only if it is 10 s or less away; otherwise skip locally, fail in CI |

- Only `GET`, `HEAD` and `POST /markdown` are retried after network errors and 5xx responses.
- One request waits at most 10 s in total.
- **Never healed:** any other 4xx, failed assertions, unexpected redirects or schema mismatches. When a schema check fails, the report includes `schema-drift.json`, which suggests a zod change for a person to review. Schemas are never loosened automatically.
- **Visible:** every heal adds a `healed` annotation, and the test attaches `api-exchanges.json` with numbered attempts. At the end of a run, the heal summary reporter prints how many live tests healed and writes `results/heals.json`.
- **Modes:**
  - `report` (default): heals are allowed and reported.
  - `off`: every request is tried once.
  - `strict`: heals still run, so the log is complete, but a healed request then fails the test.
- **CI:** pushes and PRs run in `report` mode, and the nightly schedule runs in `strict` mode.

The `self-heal` project (`tests/self-heal/`) checks these rules against `helpers/stubServer.ts`. Each test sets its own mode, so the results are the same whatever `HEAL_MODE` is.

## Layout

```text
clients/    BaseClient (recording and healing), healPolicy, SiteClient, GitHubClient
config/     env loader and portfolio facts (owner, canonical URL, the portfolio repos)
payloads/   typed query and POST body builders
schemas/    zod schemas for GitHub success and error bodies
fixtures/   api (clients, logging, heal annotations), github (rate-limit guard), selfHeal (stub)
helpers/    expectSchema, redact, stubServer, noteKnownGap
reporters/  healSummary
tests/      site/, github/, self-heal/
```

## Conventions

- Every JSON response goes through `expectSchema(response, Schema)`, which returns typed data. On a mismatch it prints one line per issue, such as `body[3].pushed_at: … received null`.
- Schemas use `z.looseObject`, so a new GitHub field never breaks a test, while the fields the tests rely on stay required.
- Request and response logs are attached only to failed or healed tests. Before anything is written, the log redacts:
  - the `Authorization`, `Cookie` and `Set-Cookie` headers
  - keys named like `token`, `*_token`, `secret`, `password` or `api_key`
  - the token value itself, wherever it appears
  - `Bearer` values, secret query parameters (`access_token`, `token`, `client_secret`, `api_key`), and header lines in Playwright's error call logs. A failed request's error is scrubbed before it is rethrown, so the token never reaches the terminal, `junit.xml` or the HTML report
- Limits GitHub Pages cannot fix, such as a missing CSP or the lack of a custom 404 page, are recorded as `known-gap` annotations, not failures.
- Commits follow Conventional Commits, and `main` is protected: changes go through a PR with CI green.

## Security

- `.env*` is gitignored except `.env.example`.
- CI uses the workflow's own `GITHUB_TOKEN`, so no personal token is stored. Only the test step receives it, and checkout does not persist credentials, so dependency install and lint code never see it.
- Dependencies are pinned to exact versions and installed with `npm ci`. `npm audit --audit-level=high` gates CI.
- Actions are pinned to commit SHAs, and the workflow has `permissions: contents: read`.
- gitleaks scans every push and PR, and Dependabot opens weekly update PRs.
- CI report artifacts are kept for 7 days.
