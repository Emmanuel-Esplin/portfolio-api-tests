import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

interface HealRecord {
  project: string;
  test: string;
  outcome: TestResult['status'];
  heals: string[];
}

/** Counts live tests that only passed by healing. The self-heal project heals on purpose, so it is left out. */
export default class HealSummaryReporter implements Reporter {
  private readonly records: HealRecord[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = test.parent.project()?.name ?? '';
    if (project === 'self-heal') return;
    const heals = result.annotations.filter((a) => a.type === 'healed').map((a) => a.description ?? '');
    if (heals.length > 0) {
      this.records.push({ project, test: test.titlePath().slice(2).join(' › '), outcome: result.status, heals });
    }
  }

  onEnd(): void {
    const file = path.join('results', 'heals.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ healedTests: this.records.length, records: this.records }, null, 2));
    const summary =
      this.records.length === 0
        ? 'Self-heal: no live test needed to heal.'
        : `Self-heal: ${this.records.length} live test(s) healed; see ${file}.\n` +
          this.records.map((r) => `  - [${r.project}] ${r.test}: ${r.heals.join(' | ')}`).join('\n');
    console.log(`\n${summary}`);
  }

  printsToStdio(): boolean {
    return false;
  }
}
