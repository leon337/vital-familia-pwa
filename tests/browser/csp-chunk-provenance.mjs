// GH Actions-only diagnostic. No network, eval, trace parsing or runtime changes.
import { readFile, writeFile, mkdir, lstat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const output = 'test-results/f02/csp-provenance';
const historical = {
  runId: '40553064012', filename: '389-271e76abcb27ae44.js',
  line: 57, column: 37243,
  declaredSha256: '52235b7199b4500fa08d2f1b0b8de16411f51e3868e112c2ea597dd7c636ec8e',
};
const chunkName = /^[A-Za-z0-9_-]+\.js$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
// Check every component: neither inputs nor output may traverse symlinks.
async function regular(filename, directory = false) {
  const parts = filename.split('/');
  if (path.isAbsolute(filename) || parts.some(p => !p || p === '.' || p === '..')) throw new Error('unsafe-path');
  for (let i = 1; i <= parts.length; i++) {
    const entry = await lstat(parts.slice(0, i).join('/'));
    if (i < parts.length || directory) {
      if (!entry.isDirectory()) throw new Error('non-directory');
    } else if (!entry.isFile()) throw new Error('nonregular-file');
  }
}
async function read(filename) { await regular(filename); return readFile(filename); }
async function json(filename) { return JSON.parse(await read(filename)); }
async function directory(filename) {
  const parts = filename.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const current = parts.slice(0, i).join('/');
    try { await mkdir(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    await regular(current, true);
  }
}

const manifest = {
  schema: 1, scope: 'Allowlisted browser build chunks and adjacent maps only; no trace or environment collection',
  attribution: 'Unresolved: preserved build bytes do not establish the eval caller or recover bytes from a previous run',
  historical, buildId: null, nextVersion: null, buildReceiptSha256: null,
  diagnostics: [], events: [], files: [],
};
await directory(output);
let failed = false;
function diagnostic(code, failure = false) {
  manifest.diagnostics.push(code);
  failed ||= failure;
}
let receipt;
try {
  const bytes = await read('test-results/f02-build-receipt.json');
  manifest.buildReceiptSha256 = digest(bytes);
  receipt = JSON.parse(bytes);
  if (!Array.isArray(receipt.files) || receipt.files.some(file => !file || typeof file.path !== 'string'
    || !/^[a-f0-9]{64}$/.test(file.sha256))) {
    receipt = undefined;
    throw new Error('invalid-receipt');
  }
  manifest.buildId = (await read('.next/BUILD_ID')).toString().trim();
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(manifest.buildId) || manifest.buildId !== receipt.buildId) {
    manifest.buildId = null;
    throw new Error('build-id-mismatch');
  }
  const version = (await json('node_modules/next/package.json')).version;
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) throw new Error('invalid-version');
  manifest.nextVersion = version;
} catch { diagnostic('build-identity-unavailable-or-invalid', true); }

const selected = new Set([historical.filename]);
try {
  await regular('test-results/f02/evidence', true);
  for (const entry of await readdir('test-results/f02/evidence', { withFileTypes: true })) {
    if (!/^[a-f0-9]{64}$/.test(entry.name) || !entry.isDirectory()) {
      diagnostic('rejected-evidence-directory', true); continue;
    }
    for (const name of ['navigation-baseline.json', 'browser-audit.json']) {
      let audit;
      try { audit = await json(`test-results/f02/evidence/${entry.name}/${name}`); }
      catch { diagnostic('audit-missing-or-invalid', true); continue; }
      if (!Array.isArray(audit.csp)) { diagnostic('invalid-csp-array', true); continue; }
      for (const event of audit.csp) {
        // Exact raw URL matching rejects credentials, query, fragments, escapes and traversal.
        const match = typeof event.sourceFile === 'string'
          && /^http:\/\/127\.0\.0\.1:3000\/_next\/static\/chunks\/([A-Za-z0-9_-]+\.js)$/.exec(event.sourceFile);
        if (event.kind !== 'csp' || event.isTrusted !== true || event.disposition !== 'enforce'
          || event.blockedURI !== 'eval' || event.effectiveDirective !== 'script-src' || !match
          || !Number.isSafeInteger(event.lineNumber) || event.lineNumber < 0
          || !Number.isSafeInteger(event.columnNumber) || event.columnNumber < 0) {
          diagnostic('rejected-csp-event', true); continue;
        }
        selected.add(match[1]);
        manifest.events.push({ evidenceId: entry.name, audit: name, filename: match[1],
          line: event.lineNumber, column: event.columnNumber,
          buildMismatchCount: Array.isArray(audit.buildMismatches) ? audit.buildMismatches.length : null });
      }
    }
  }
} catch { diagnostic('evidence-unavailable', true); }

for (const name of [...selected].sort()) {
  if (!chunkName.test(name)) { diagnostic('rejected-chunk-name', true); continue; }
  const source = `.next/static/chunks/${name}`;
  let bytes;
  try { bytes = await read(source); }
  catch {
    diagnostic(name === historical.filename ? 'historical-chunk-absent-in-current-build' : 'reported-chunk-unavailable', name !== historical.filename);
    continue;
  }
  const sha256 = digest(bytes);
  const matches = receipt?.files?.filter(file => file.path === source) ?? [];
  if (matches.length !== 1 || matches[0].sha256 !== sha256) {
    diagnostic('chunk-receipt-mismatch', true); continue;
  }
  await writeFile(`${output}/${name}`, bytes, { flag: 'wx' });
  const record = { path: source, artifact: name, size: bytes.length, sha256,
    receiptMatch: true, sourceMap: 'absent' };
  if (name === historical.filename) record.historicalDeclaredHashMatch = sha256 === historical.declaredSha256;
  // Never follow sourceMappingURL or map source paths (including absolute/data URLs).
  // Only the adjacent regular browser map, also authenticated by the build receipt.
  try {
    const map = await read(`${source}.map`);
    const mapHash = digest(map);
    const mapMatches = receipt?.files?.filter(file => file.path === `${source}.map`) ?? [];
    if (mapMatches.length !== 1 || mapMatches[0].sha256 !== mapHash) throw new Error('map-receipt-mismatch');
    await writeFile(`${output}/${name}.map`, map, { flag: 'wx' });
    record.sourceMap = { artifact: `${name}.map`, size: map.length, sha256: mapHash, receiptMatch: true };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      record.sourceMap = 'rejected-or-unreadable'; diagnostic('source-map-rejected-or-unreadable', true);
    }
  }
  manifest.files.push(record);
}
await writeFile(`${output}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
if (failed) process.exitCode = 1;
