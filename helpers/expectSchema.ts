import { expect, test, type APIResponse } from '@playwright/test';
import type { z } from 'zod';
import { redact } from './redact';

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (out, key) => (typeof key === 'number' ? `${out}[${key}]` : `${out}.${String(key)}`),
    'body',
  );
}

function valueAt(body: unknown, path: PropertyKey[]): unknown {
  return path.reduce<unknown>(
    (node, key) => (node && typeof node === 'object' ? (node as Record<PropertyKey, unknown>)[key] : undefined),
    body,
  );
}

function describe(value: unknown): string {
  if (value === undefined) return 'undefined';
  const json = JSON.stringify(value);
  return json.length > 60 ? `${json.slice(0, 60)}…` : json;
}

interface DriftProposal {
  field: string;
  occurrences: number;
  received: string;
  suggestion: string;
}

/** Suggests the schema change that would accept what was received. A person decides whether to apply it. */
function proposeFix(issue: z.core.$ZodIssue, received: unknown): string {
  if (issue.code !== 'invalid_type') return `review the constraint: ${issue.message}`;
  const current = `z.${issue.expected}()`;
  if (received === null) return `${current} → ${current}.nullable()`;
  if (received === undefined) return `${current} → ${current}.optional()`;
  const actual = Array.isArray(received) ? 'array' : typeof received;
  return `${current} → z.${actual}() (or a union, if both are valid)`;
}

function driftProposals(issues: z.core.$ZodIssue[], body: unknown): DriftProposal[] {
  const byKey = new Map<string, DriftProposal>();
  for (const issue of issues) {
    // Array indexes are dropped, so one drift across many items is one proposal.
    const field = issue.path.filter((key) => typeof key !== 'number').map(String).join('.') || '<root>';
    const value = valueAt(body, issue.path);
    const suggestion = proposeFix(issue, value);
    const key = `${field}|${suggestion}`;
    const existing = byKey.get(key);
    if (existing) existing.occurrences++;
    else byKey.set(key, { field, occurrences: 1, received: describe(value), suggestion });
  }
  return [...byKey.values()];
}

/** Parses the response as JSON, validates it, and returns the typed data. */
export async function expectSchema<T extends z.ZodType>(response: APIResponse, schema: T): Promise<z.infer<T>> {
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      `Expected a JSON body but got status ${response.status()}, content-type ` +
        `${response.headers()['content-type'] ?? '<none>'}: ${text.slice(0, 200)}`,
    );
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      // zod already names the received type for invalid_type; add the value for everything else.
      const received = issue.code === 'invalid_type' ? '' : `, received ${describe(valueAt(body, issue.path))}`;
      return `${formatPath(issue.path)}: ${issue.message}${received}`;
    });
    const testInfo = test.info();
    await testInfo.attach('response-body.json', { body: redact(body, [process.env.GITHUB_TOKEN]), contentType: 'application/json' });
    await testInfo.attach('schema-drift.json', {
      body: JSON.stringify(driftProposals(result.error.issues, body), null, 2),
      contentType: 'application/json',
    });
    expect(issues, `${response.url()} does not match the schema`).toEqual([]);
  }
  return result.data as z.infer<T>;
}
