import { expect, test, type APIResponse } from '@playwright/test';
import type { z } from 'zod';

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
    const issues = result.error.issues.map(
      (issue) => `${formatPath(issue.path)}: ${issue.message}, received ${describe(valueAt(body, issue.path))}`,
    );
    await test.info().attach('response-body.json', { body: JSON.stringify(body, null, 2), contentType: 'application/json' });
    expect(issues, `${response.url()} does not match the schema`).toEqual([]);
  }
  return result.data as z.infer<T>;
}
