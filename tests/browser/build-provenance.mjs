// Public build bytes only. No directory discovery or environment collection.
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const output = 'test-results/f02-build-provenance';
const receiptPath = 'test-results/f02-build-receipt.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const maxFile = 32 * 1024 * 1024;
const maxTotal = 128 * 1024 * 1024;
export const provenanceRoot = output;
// Brackets are literal filename characters, including Next's [...path] component.
// The first character cannot be a dot; separators and control bytes are excluded.
const safeComponent = name => !/[\x00-\x1F\x7F]/.test(name)
  && /^[A-Za-z0-9_\x5B\x5D-][A-Za-z0-9_.\x5B\x5D-]*$/.test(name);
async function regular(filename, directory = false) {
  const parts = filename.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const info = await lstat(parts.slice(0, i).join('/'));
    if ((i < parts.length || directory) ? !info.isDirectory() : !info.isFile()) {
      throw new Error('Nonregular build provenance path');
    }
  }
}
async function boundedRead(filename, limit) {
  await regular(filename);
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > limit) throw new Error('Build provenance size limit');
    const bytes = Buffer.alloc(info.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, null);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    if (length !== info.size) throw new Error('Build provenance size drift');
    return bytes.subarray(0, length);
  } finally { await handle.close(); }
}
async function inventory() {
  const bytes = await boundedRead(receiptPath, 1024 * 1024);
  const receipt = JSON.parse(bytes);
  if (!Array.isArray(receipt.files) || receipt.files.length !== 42) throw new Error('Expected exactly 42 build receipt entries');
  const seen = new Set();
  let total = 0;
  const entries = receipt.files.map(file => {
    if (!file || typeof file.path !== 'string'
      || !(file.path.startsWith('.next/static/') || file.path.startsWith('public/ocr/'))
      || !file.path.split('/').slice(1).every(safeComponent)
      || seen.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)
      || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > maxFile) {
      throw new Error('Rejected build receipt entry');
    }
    seen.add(file.path);
    total += file.size;
    const artifact = `${output}/${file.path.startsWith('.next/') ? file.path.slice(1) : file.path}`;
    return { path: file.path, artifact, size: file.size, sha256: file.sha256 };
  });
  if (total > maxTotal) throw new Error('Build provenance total size limit');
  return { schema: 1, buildReceiptSha256: sha256(bytes), count: entries.length, totalBytes: total, files: entries };
}
async function directory(filename) {
  const parts = filename.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const current = parts.slice(0, i).join('/');
    try { await mkdir(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    await regular(current, true);
  }
}
export async function collectBuildProvenance() {
  const manifest = await inventory(); // Validate the complete allowlist before any copy.
  await regular('test-results', true);
  await mkdir(output); // Existing output is rejected; never merge stale evidence.
  for (const entry of manifest.files) {
    const bytes = await boundedRead(entry.path, maxFile);
    if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) throw new Error('Build receipt bytes mismatch');
    await directory(entry.artifact.slice(0, entry.artifact.lastIndexOf('/')));
    await writeFile(entry.artifact, bytes, { flag: 'wx' });
  }
  await writeFile(`${output}/receipt.json`, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  await verifyBuildProvenance();
}
export async function verifyBuildProvenance() {
  const expected = await inventory();
  const receipt = await boundedRead(`${output}/receipt.json`, 1024 * 1024);
  if (JSON.stringify(JSON.parse(receipt)) !== JSON.stringify(expected)) throw new Error('Build provenance receipt mismatch');
  const allowed = new Set([...expected.files.map(entry => entry.artifact), `${output}/receipt.json`]);
  async function walk(dir) {
    await regular(dir, true);
    const names = await readdir(dir);
    if (!names.length) throw new Error('Empty build provenance directory');
    for (const name of names) {
      if (!safeComponent(name)) throw new Error('Unsafe build provenance output');
      const filename = `${dir}/${name}`;
      const info = await lstat(filename);
      if (info.isDirectory()) await walk(filename);
      else if (!info.isFile() || !allowed.delete(filename)) throw new Error('Unexpected build provenance output');
    }
  }
  await walk(output);
  if (allowed.size) throw new Error('Missing build provenance output');
  for (const entry of expected.files) {
    const bytes = await boundedRead(entry.artifact, maxFile);
    if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) throw new Error('Build provenance checksum mismatch');
  }
  return expected;
}
