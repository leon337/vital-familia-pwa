import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, stat, lstat, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = 'test-results/f02';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(name));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`Nonregular artifact: ${name}`);
  }
  return result.sort();
}
export const scenarios = [
  { name: 'glucose', title: 'real OCR glucose: review, edit, reconfirm and save', fixture: 'glucose.png', positive: true },
  { name: 'pressure', title: 'real OCR pressure: review, edit, reconfirm and save', fixture: 'pressure.png', positive: true },
  { name: 'unreadable', title: 'valid PNG with unreadable display falls back without registration', fixture: 'blank-invalid-display.png' },
  { name: 'corrupt', title: 'corrupt PNG is rejected without registration and permits manual entry', fixture: 'corrupt.png' },
];
export const safeTestId = testId => hash(String(testId));
export const evidenceDir = testId => path.join(root, 'evidence', safeTestId(testId));
export async function writeEvidence(testInfo, name, bytes, contentType) {
  if (!/^[a-z0-9-]+\.(json|png)$/.test(name)) throw new Error('Unsafe evidence name');
  const dir = evidenceDir(testInfo.testId);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, name);
  await writeFile(target, bytes, { flag: 'wx' });
  await testInfo.attach(name, { path: path.resolve(target), contentType });
}
export async function sealEvidence(test, result) {
  const scenario = scenarios.find(item => item.title === test.title);
  if (!scenario) return;
  const dir = evidenceDir(test.id);
  await mkdir(dir, { recursive: true });
  const failures = [];
  for (const [attachmentName, filename] of [['trace', 'trace.zip'], ['screenshot', 'screenshot.png']]) {
    try {
      const attachments = result.attachments.filter(item => item.name === attachmentName);
      if (attachments.length !== 1 || !attachments[0].path) throw new Error(`Missing/ambiguous ${attachmentName}: ${scenario.name}`);
      const source = attachments[0].path;
      if (!(await lstat(source)).isFile()) throw new Error('Nonregular attachment');
      await copyFile(source, path.join(dir, filename), 1); // COPYFILE_EXCL
    } catch (error) { failures.push(error); }
  }
  const inventory = await Promise.all((await files(dir)).map(async filename => ({
    name: path.basename(filename), sha256: hash(await readFile(filename)), size: (await stat(filename)).size,
  })));
  await writeFile(path.join(dir, 'receipt.json'), JSON.stringify({ testId: test.id, safeId: safeTestId(test.id),
    scenario: scenario.name, title: test.title, status: result.status,
    sealingErrors: failures.map(error => String(error)), files: inventory }, null, 2), { flag: 'wx' });
  if (failures.length) throw new AggregateError(failures, `Incomplete evidence: ${scenario.name}`);
}
export async function buildIdentity() {
  const chunks = [...await files('.next/static'), ...await files('public/ocr')];
  if (!chunks.some(name => name.endsWith('.js'))) throw new Error('Missing built chunks');
  return { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    buildId: (await readFile('.next/BUILD_ID', 'utf8')).trim(),
    files: await Promise.all(chunks.map(async name => ({ path: name, sha256: hash(await readFile(name)) }))) };
}
export async function receipt() {
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/f02-build-receipt.json', JSON.stringify(await buildIdentity(), null, 2));
}
export async function finalize() {
  const receiptBytes = await readFile('test-results/f02-build-receipt.json');
  if (JSON.stringify(JSON.parse(receiptBytes)) !== JSON.stringify(await buildIdentity())) throw new Error('Build identity drift');
  const list = [...await files(root), ...await files('playwright-report'), 'test-results/f02-build-receipt.json'];
  for (const required of [`${root}/results.json`, `${root}/audit-reporter.json`, 'playwright-report/index.html']) {
    if (!list.includes(required)) throw new Error(`Missing evidence: ${required}`);
  }
  const results = JSON.parse(await readFile(`${root}/audit-reporter.json`, 'utf8'));
  if (results.status !== 'passed' || !Array.isArray(results.errors) || results.errors.length || results.tests.length !== 6 || results.tests.some(t => t.status !== 'passed' || t.sealingError) || new Set(results.tests.map(t => t.testId)).size !== 6) throw new Error('Incomplete or failed gate');
  for (const title of ['adversarial CSP events never obtain a startup exemption', 'requests reject URL exfiltration, bodies, methods and external origins']) {
    if (results.tests.filter(test => test.file === 'csp-audit.e2e.mjs' && test.title.at(-1) === title).length !== 1) throw new Error(`Missing security fixture: ${title}`);
  }
  const matrix = [];
  for (const scenario of scenarios) {
    const matches = results.tests.filter(test => test.title.at(-1) === scenario.title && test.file === 'ocr-real.e2e.mjs');
    if (matches.length !== 1) throw new Error(`Missing/duplicate scenario: ${scenario.name}`);
    const test = matches[0];
    const dir = evidenceDir(test.testId);
    const receipt = JSON.parse(await readFile(path.join(dir, 'receipt.json'), 'utf8'));
    if (receipt.testId !== test.testId || receipt.safeId !== safeTestId(test.testId) || receipt.scenario !== scenario.name
      || receipt.title !== scenario.title || receipt.status !== 'passed' || receipt.sealingErrors?.length) throw new Error('Scenario receipt mismatch');
    const required = ['navigation-baseline.json', 'browser-audit.json', scenario.fixture, 'trace.zip', 'screenshot.png',
      ...(scenario.positive ? ['wasm-http-checksums.json'] : [])];
    const physical = (await files(dir)).map(filename => path.relative(dir, filename)).filter(name => name !== 'receipt.json');
    if (physical.length !== required.length || physical.some(name => !required.includes(name))) throw new Error('Physical inventory mismatch');
    if (receipt.files.length !== required.length || new Set(receipt.files.map(file => file.name)).size !== required.length) throw new Error('Unexpected receipt inventory');
    for (const name of required) {
      const entry = receipt.files.find(file => file.name === name);
      if (!entry) throw new Error(`Missing evidence: ${scenario.name}/${name}`);
      const filename = path.join(dir, name);
      if (!(await lstat(filename)).isFile()) throw new Error(`Nonregular evidence: ${filename}`);
      const bytes = await readFile(filename);
      if (!bytes.length || entry.size !== bytes.length || entry.sha256 !== hash(bytes)) throw new Error(`Evidence checksum mismatch: ${filename}`);
    }
    const audit = JSON.parse(await readFile(path.join(dir, 'browser-audit.json'), 'utf8'));
    if (audit.collectionError || audit.testErrors?.length || !audit.baseline || !audit.storage || !audit.ready) throw new Error(`Incomplete browser audit: ${scenario.name}`);
    const baseline = JSON.parse(await readFile(path.join(dir, 'navigation-baseline.json'), 'utf8'));
    if (!baseline.baseline || baseline.csp.length || audit.csp.length
      || JSON.stringify(baseline.baseline) !== JSON.stringify(audit.baseline)) throw new Error('Invalid CSP evidence');
    for (const key of ['buildMismatches', 'failedRequests', 'rejectedRequests', 'cookieHeaders', 'external', 'writes', 'unexpectedSecurity', 'unexpectedErrors', 'localStorage', 'indexedDB', 'sessionStorage']) {
      if (!Array.isArray(audit[key]) || audit[key].length) throw new Error(`Invalid audit: ${scenario.name}/${key}`);
    }
    if (!Array.isArray(audit.storage.cookies) || audit.storage.cookies.length) throw new Error('Invalid cookie evidence');
    if (scenario.positive) {
      const proof = JSON.parse(await readFile(path.join(dir, 'wasm-http-checksums.json'), 'utf8'));
      const variants = ['', '-simd', '-lstm', '-simd-lstm'];
      if (proof.length !== variants.length) throw new Error('Incomplete WASM proof');
      for (const variant of variants) {
        const assetPath = `/ocr/core/tesseract-core${variant}.wasm`;
        const entries = proof.filter(item => item.path === assetPath);
        const built = JSON.parse(receiptBytes).files.find(item => item.path === `public${assetPath}`);
        if (entries.length !== 1 || entries[0].status !== 200 || entries[0].coreVersion !== '6.0.0'
          || !built || entries[0].sha256 !== built.sha256) throw new Error(`Invalid WASM proof: ${scenario.name}/${assetPath}`);
      }
    }
    matrix.push({ scenario: scenario.name, testId: test.testId, receipt: path.join(dir, 'receipt.json'), required });
  }
  const artifacts = await Promise.all(list.filter(name => !name.endsWith('/manifest.json')).map(async name => {
    if (!(await stat(name)).size) throw new Error(`Empty evidence: ${name}`);
    return { path: name, sha256: hash(await readFile(name)) };
  }));
  await writeFile(`${root}/manifest.json`, JSON.stringify({ syntheticOnly: true,
    scope: 'Generated fictional display fixtures and isolated localhost browser; no PHI inputs authorized',
    buildReceiptSha256: hash(receiptBytes), matrix, artifacts }, null, 2));
}
if (process.argv[2] === 'build') await receipt();
if (process.argv[2] === 'finalize') await finalize();
