import { z } from 'zod';

/** 404 and most other GitHub errors; /markdown also uses this shape for its 422. */
export const GitHubError = z.looseObject({
  message: z.string(),
  documentation_url: z.url(),
  status: z.string().optional(),
});

/** 422 responses that name the fields that failed. */
export const GitHubValidationError = GitHubError.extend({
  errors: z.array(
    z.looseObject({
      resource: z.string(),
      field: z.string(),
      code: z.string(),
    }),
  ),
});

export type GitHubError = z.infer<typeof GitHubError>;
