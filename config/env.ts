import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

export const HEAL_MODES = ['off', 'report', 'strict'] as const;
export type HealMode = (typeof HEAL_MODES)[number];

const ENV = process.env.ENV ?? 'local';

// Real environment variables win over the file, so CI needs no .env file.
dotenv.config({ path: path.resolve(__dirname, '..', `.env.${ENV}`), quiet: true });

const httpsUrl = z
  .url({ protocol: /^https$/, error: 'must be an https:// URL' })
  .transform((url) => url.replace(/\/+$/, ''));

const EnvSchema = z.object({
  SITE_BASE_URL: httpsUrl.default('https://emmanuel-esplin.github.io'),
  GITHUB_API_BASE_URL: httpsUrl.default('https://api.github.com'),
  GITHUB_USER: z.string({ error: 'is required' }).min(1, 'is required'),
  GITHUB_TOKEN: z.string().min(1).optional(),
  HEAL_MODE: z.enum(HEAL_MODES, { error: `must be one of ${HEAL_MODES.join(', ')}` }).default('report'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  // Empty strings (e.g. an unset CI secret) count as missing.
  const raw = Object.fromEntries(
    Object.keys(EnvSchema.shape).map((key) => [key, process.env[key] || undefined]),
  );
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    // Names the variable and the rule it broke, never the value.
    const problems = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment (ENV=${ENV}):\n${problems.join('\n')}`);
  }
  return result.data;
}

export const env = loadEnv();
export const isCI = Boolean(process.env.CI);
