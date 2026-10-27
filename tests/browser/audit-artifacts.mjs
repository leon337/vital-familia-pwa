import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, stat, lstat, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = 'test-results/f02';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(dir, hiddenInput = null) {
  if (!(await lstat(dir)).isDirectory()) throw new Error(`Nonregular artifact directory: ${dir}`);
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (name === hiddenInput && entry.isFile()) continue;
    if (entry.name.startsWith('.') || /[\\/]/.test(entry.name)) {
      throw new Error(`Hidden or unsafe artifact path: ${name}`);
    }
    if (entry.isDirectory()) result.push(...await files(name, hiddenInput));
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
const requiredSecurityTitles = [
  'adversarial CSP events never obtain a startup exemption',
  'requests reject URL exfiltration, bodies, methods and external origins',
  'every query is rejected even with forged Next RSC and prefetch headers',
];
const expectedTestCount = scenarios.length + requiredSecurityTitles.length;
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
  for (const dir of ['test-results', root, 'playwright-report']) {
    if (!(await lstat(dir)).isDirectory()) throw new Error(`Nonregular artifact directory: ${dir}`);
  }
  const receiptBytes = await readFile('test-results/f02-build-receipt.json');
  if (JSON.stringify(JSON.parse(receiptBytes)) !== JSON.stringify(await buildIdentity())) throw new Error('Build identity drift');
  // playwright.config.mjs resolves outputDir ../../test-results/f02 from tests/browser.
  // upload-artifact excludes hidden files; publish only this strictly validated receipt.
  const lastRunPath = `${root}/.last-run.json`;
  const lastRunStat = await lstat(lastRunPath);
  if (!lastRunStat.isFile() || lastRunStat.size > 4096) throw new Error('Invalid Playwright last-run receipt');
  const lastRun = JSON.parse(await readFile(lastRunPath, 'utf8'));
  if (!lastRun || Array.isArray(lastRun) || Object.keys(lastRun).sort().join(',') !== 'failedTests,status'
    || lastRun.status !== 'passed' || !Array.isArray(lastRun.failedTests) || lastRun.failedTests.length) {
    throw new Error('Incomplete or unexpected Playwright last-run receipt');
  }
  const lastRunAlias = `${root}/last-run.json`;
  const canonicalLastRun = Buffer.from(JSON.stringify({ status: 'passed', failedTests: [] }, null, 2));
  // Validate every entry, including empty directories, before creating the alias.
  const list = [...await files(root, lastRunPath), ...await files('playwright-report'), 'test-results/f02-build-receipt.json'];
  for (const name of list) {
    if (path.isAbsolute(name) || name.split(/[\\/]/).some(part => part.startsWith('.'))) {
      throw new Error(`Hidden or unsafe artifact path: ${name}`);
    }
  }
  try {
    await writeFile(lastRunAlias, canonicalLastRun, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const aliasStat = await lstat(lastRunAlias);
    if (!aliasStat.isFile() || aliasStat.size !== canonicalLastRun.length
      || !(await readFile(lastRunAlias)).equals(canonicalLastRun)) {
      throw new Error('Invalid or divergent Playwright last-run alias');
    }
  }
  if (!list.includes(lastRunAlias)) list.push(lastRunAlias);
  list.sort();
  for (const required of [`${root}/results.json`, `${root}/audit-reporter.json`, 'playwright-report/index.html']) {
    if (!list.includes(required)) throw new Error(`Missing evidence: ${required}`);
  }
  const results = JSON.parse(await readFile(`${root}/audit-reporter.json`, 'utf8'));
  if (results.status !== 'passed' || !Array.isArray(results.errors) || results.errors.length
    || !Array.isArray(results.tests) || results.tests.length !== expectedTestCount
    || results.tests.some(t => t.status !== 'passed' || t.sealingError || typeof t.testId !== 'string' || !t.testId)
    || new Set(results.tests.map(t => t.testId)).size !== expectedTestCount) throw new Error('Incomplete or failed gate');
  for (const title of requiredSecurityTitles) {
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
    if (JSON.stringify(baseline.isolationBefore) !== JSON.stringify(audit.isolationBefore)) throw new Error('Isolation baseline mismatch');
    for (const snapshot of [baseline.isolationBefore, audit.isolationAfter]) {
      if (!snapshot || snapshot.serviceWorkerController !== null
        || !Array.isArray(snapshot.serviceWorkerRegistrations) || snapshot.serviceWorkerRegistrations.length
        || !Array.isArray(snapshot.cacheStorage) || snapshot.cacheStorage.length) throw new Error('Invalid SW/CacheStorage isolation evidence');
    }
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
