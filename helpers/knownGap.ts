import { test } from '@playwright/test';

/** Records a gap the suite cannot fix (e.g. a GitHub Pages limit) without failing the test. */
export function noteKnownGap(present: boolean, description: string): void {
  if (!present) test.info().annotations.push({ type: 'known-gap', description });
}
