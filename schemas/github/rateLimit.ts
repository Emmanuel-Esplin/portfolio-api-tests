import { z } from 'zod';

const RateResource = z.looseObject({
  limit: z.number().int(),
  remaining: z.number().int(),
  reset: z.number().int(),
  used: z.number().int(),
});

export const RateLimit = z.looseObject({
  resources: z.looseObject({ core: RateResource }),
  /** The core limit, repeated at the top level. */
  rate: RateResource,
});

export type RateLimit = z.infer<typeof RateLimit>;
