import { z } from 'zod';

export const GitHubRepo = z.looseObject({
  id: z.number().int(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  fork: z.boolean(),
  html_url: z.url(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  pushed_at: z.iso.datetime(),
  owner: z.looseObject({ login: z.string() }),
});

export const GitHubRepoList = z.array(GitHubRepo);

export type GitHubRepo = z.infer<typeof GitHubRepo>;
