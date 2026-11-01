import { z } from 'zod';

export const GitHubUser = z.looseObject({
  login: z.string(),
  id: z.number().int(),
  type: z.string(),
  html_url: z.url(),
  name: z.string().nullable(),
  public_repos: z.number().int().nonnegative(),
  created_at: z.iso.datetime(),
});

export type GitHubUser = z.infer<typeof GitHubUser>;
