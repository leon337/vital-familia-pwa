import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildIdentity, sealEvidence } from './audit-artifacts.mjs';
export default class AuditReporter {
  tests = [];
  pending = [];
  errors = [];
  onBegin() {
    // Playwright does not await onBegin/onTestEnd. Drain every task in onEnd.
    this.pending.push((async () => {
      const receipt = JSON.parse(await readFile('test-results/f02-build-receipt.json', 'utf8'));
      if (JSON.stringify(receipt) !== JSON.stringify(await buildIdentity())) throw new Error('Missing or changed build receipt');
    })().catch(error => { this.errors.push(String(error)); }));
  }
  onTestEnd(test, result) {
    this.pending.push((async () => {
      let sealingError;
      try { await sealEvidence(test, result); } catch (error) {
        sealingError = String(error);
        this.errors.push(sealingError);
      }
      this.tests.push({ testId: test.id, file: path.basename(test.location.file), title: test.titlePath(),
        status: result.status, sealingError: sealingError ?? null,
        attachments: result.attachments.map(a => ({ name: a.name, path: a.path, contentType: a.contentType })) });
    })());
  }
  async onEnd(result) {
    const settled = await Promise.allSettled(this.pending);
    for (const item of settled) if (item.status === 'rejected') this.errors.push(String(item.reason));
    const status = this.errors.length ? 'failed' : result.status;
    await mkdir('test-results/f02', { recursive: true });
    await writeFile('test-results/f02/audit-reporter.json', JSON.stringify({ status, errors: this.errors, tests: this.tests }, null, 2));
    // Explicitly fail Playwright for evidence errors; never convert them to warnings.
    return { status };
  }
}
