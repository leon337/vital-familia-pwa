import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { classifyCsp, knownEvalDiagnostic } from './helpers/csp-audit.mjs';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Direct CDP evaluation avoids Playwright's main-world UtilityScript eval probe.
// CSP remains enforced; only the narrowly classified startup framework event is expected.
async function browserValue(page, fn, arg) {
  const { result, exceptionDetails } = await page.__f02Session.send('Runtime.evaluate', {
    expression: `(${fn.toString()})(${JSON.stringify(arg) ?? 'undefined'})`,
    awaitPromise: true, returnByValue: true, allowUnsafeEvalBlockedByCSP: false,
  });
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
  return result.value;
}

// Real raster pixels, no OCR/parser/worker mocks or injected recognition results.
// Canvas uses a runner-installed font, and no fixture text is sent to the app.
async function fixture(page, lines, name, testInfo) {
  const base64 = await browserValue(page, async (textLines) => {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = Math.max(300, textLines.length * 130 + 140);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.font = '64px "Liberation Sans"';
    ctx.textBaseline = 'top';
    textLines.forEach((line, i) => ctx.fillText(line, 100, 70 + i * 130));
    return canvas.toDataURL('image/png').split(',')[1];
  }, lines);
  const buffer = Buffer.from(base64, 'base64');
  await testInfo.attach(name, { body: buffer, contentType: 'image/png' });
  return { name: `${name}.png`, mimeType: 'image/png', buffer };
}

const photo = page => page.getByRole('main').getByRole('region', { name: 'Foto do aparelho', exact: true });
const confirmation = page => photo(page).getByRole('checkbox', { name: /Conferi e confirmo/ });
const save = page => photo(page).getByRole('button', { name: 'Registrar exemplo confirmado' });
async function historyCount(page) {
  await page.locator('nav').getByRole('button', { name: /Histórico/ }).click();
  return page.locator('tbody tr').count();
}
async function openPhoto(page) {
  const primary = page.getByRole('main').getByRole('button', { name: '＋ Nova medição', exact: true });
  await expect(primary).toHaveCount(1);
  await primary.click();
  await expect(photo(page)).toBeVisible();
  await photo(page).getByRole('checkbox', { name: /Declaro que a imagem/ }).check();
}

// Install restrictions before navigation, including traffic initiated by workers.
// SW is blocked. Worker response visibility is not used as proof of WASM delivery.
test.beforeEach(async ({ context, page }, testInfo) => {
  const external = [], writes = [], assets = [], errors = [], cookieHeaders = [], security = [], failedRequests = [];
  // Register audit before setup assertions so setup failures also retain evidence.
  testInfo._f02 = { external, writes, assets, errors, cookieHeaders, security, failedRequests };
  page.__f02Session = await context.newCDPSession(page);
  page.__f02Session.on('Log.entryAdded', ({ entry }) => {
    if (entry.source === 'security') security.push(entry);
  });
  await page.__f02Session.send('Log.enable');
  await context.routeWebSocket('**/*', socket => {
    external.push({ url: socket.url(), method: 'WebSocket' });
    socket.close();
  });
  context.on('requestfailed', request => failedRequests.push({
    url: request.url(), failure: request.failure(),
  }));
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = await request.allHeaders();
    if (headers.cookie) cookieHeaders.push({ direction: 'request', url: request.url() });
    if (request.postDataBuffer()) writes.push({ url: request.url(), method: request.method(), hasBody: true });
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (url.origin !== 'http://127.0.0.1:3000') {
        external.push({ url: request.url(), method: request.method() });
        return route.abort('blockedbyclient');
      }
      if (request.method() !== 'GET' && request.method() !== 'HEAD') {
        writes.push({ url: request.url(), method: request.method() });
        return route.abort('blockedbyclient');
      }
    }
    await route.continue();
  });
  context.on('response', async response => {
    if ((await response.headersArray()).some(header => header.name.toLowerCase() === 'set-cookie')) {
      cookieHeaders.push({ direction: 'response', url: response.url() });
    }
    if (new URL(response.url()).pathname.startsWith('/ocr/')) {
      assets.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('pageerror', error => errors.push({ text: String(error), url: undefined }));
  page.on('console', message => {
    if (message.type() === 'error' || /content.security.policy|permissions.policy|camera/i.test(message.text())) {
      errors.push({ text: message.text(), url: message.location().url });
    }
  });
  await page.addInitScript(() => {
    window.__f02Csp = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.__f02Csp.push({
        directive: event.violatedDirective, effectiveDirective: event.effectiveDirective,
        blockedURI: event.blockedURI, sourceFile: event.sourceFile,
        lineNumber: event.lineNumber, columnNumber: event.columnNumber,
        sample: event.sample, disposition: event.disposition,
        originalPolicy: event.originalPolicy, time: performance.now(),
      });
    });
  });
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response.headers()['content-security-policy']).not.toMatch(/(?:^|\s)'unsafe-eval'(?:\s|;|$)/);
  expect(response.headers()['content-security-policy']).toContain("connect-src 'self'");
  expect(response.headers()['content-security-policy']).toContain("worker-src 'self'");
  expect(response.headers()['permissions-policy']).toContain('camera=(self)');
  await expect(page.getByText(/AMBIENTE DEMONSTRATIVO/)).toBeVisible();
});

test.afterEach(async ({ context, page }, testInfo) => {
  const audit = testInfo._f02;
  if (!audit) return;
  const browser = await browserValue(page, async () => ({
    csp: window.__f02Csp, sessionStorage: Object.keys(sessionStorage),
    localStorage: Object.keys(localStorage), indexedDB: await indexedDB.databases(),
  }));
  const { csp } = browser;
  const classification = classifyCsp(csp);
  const unexpectedSecurity = audit.security.filter(entry => !knownEvalDiagnostic(entry.text, entry.url, classification));
  const unexpectedErrors = audit.errors.filter(message => !knownEvalDiagnostic(message.text, message.url, classification));
  // Do not use storageState here: its main-world evaluation can initialize the
  // same UtilityScript eval probe that this audit deliberately avoids.
  const storage = { cookies: await context.cookies() };
  await testInfo.attach('browser-audit', {
    body: Buffer.from(JSON.stringify({ ...audit, ...browser, storage, classification, unexpectedSecurity, unexpectedErrors }, null, 2)), contentType: 'application/json',
  });
  expect.soft(storage.cookies, 'No cookies, including HttpOnly/third-party cookies').toEqual([]);
  expect.soft(browser.localStorage, 'No persistent local data').toEqual([]);
  expect.soft(browser.indexedDB, 'No persisted OCR/clinical database').toEqual([]);
  expect.soft(browser.sessionStorage, 'No session persistence').toEqual([]);
  expect.soft(audit.cookieHeaders, 'No cookie exchange').toEqual([]);
  expect.soft(audit.external, 'No attempt to contact third parties').toEqual([]);
  expect.soft(audit.writes, 'No image upload or backend write').toEqual([]);
  expect.soft(classification.known, 'Exactly one enforced Next startup eval block').toHaveLength(1);
  expect.soft(classification.unexpected, 'All other CSP violations fail').toEqual([]);
  expect.soft(unexpectedSecurity, 'No other browser security diagnostics (including workers)').toEqual([]);
  expect.soft(unexpectedErrors, 'No other console errors, camera/policy warnings or uncaught errors').toEqual([]);
});

for (const sample of [
  { name: 'glucose', lines: ['123 mg/dL'], values: [['Glicemia', '123']], edited: '124', saved: '124 mg/dL' },
  { name: 'pressure', lines: ['SYS: 120 mmHg', 'DIA: 80 mmHg', 'PUL: 72 bpm'],
    values: [['Sistólica (mmHg)', '120'], ['Diastólica (mmHg)', '80'], ['Pulso visível (bpm, opcional)', '72']],
    edited: '121', saved: '121/80 mmHg · 72 bpm' },
]) {
  test(`real OCR ${sample.name}: review, edit, reconfirm and save`, async ({ page }, testInfo) => {
    const initial = await historyCount(page);
    await openPhoto(page);
    const image = await fixture(page, sample.lines, sample.name, testInfo);
    await photo(page).getByLabel('Escolher foto sintética da galeria').setInputFiles(image);
    await expect(photo(page).getByText('Leitura extraída — ainda não registrada')).toBeVisible();
    for (const [label, value] of sample.values) {
      await expect(photo(page).getByLabel(label, { exact: true })).toHaveValue(value);
    }
    if (sample.name === 'glucose') await expect(photo(page).getByLabel('Unidade visível')).toHaveValue('mg/dL');
    await expect(confirmation(page)).not.toBeChecked();
    await expect(save(page)).toBeDisabled();
    // Leaving an unconfirmed OCR review must not append any record.
    expect(await historyCount(page)).toBe(initial);
    await openPhoto(page);
    await photo(page).getByLabel('Escolher foto sintética da galeria').setInputFiles(image);
    await expect(photo(page).getByText('Leitura extraída — ainda não registrada')).toBeVisible();
    await confirmation(page).check();
    await expect(save(page)).toBeEnabled();
    await photo(page).getByLabel(sample.values[0][0], { exact: true }).fill(sample.edited);
    await expect(confirmation(page)).not.toBeChecked();
    await expect(save(page)).toBeDisabled();
    await confirmation(page).check();
    await save(page).click();
    await expect(page.locator('tbody tr')).toHaveCount(initial + 1);
    await expect(page.getByRole('cell', { name: sample.saved, exact: true })).toBeVisible();
    await expect(page.getByText('Exemplo confirmado adicionado somente à memória. Foto descartada.')).toBeVisible();
    const assets = testInfo._f02.assets;
    for (const path of ['/ocr/tesseract.esm.min.js', '/ocr/worker.min.js', '/ocr/lang/eng.traineddata.gz']) {
      expect(assets.some(a => new URL(a.url).pathname === path && a.status === 200), path).toBe(true);
    }
    // APIRequestContext does not depend on worker response event visibility.
    // Reference is the local build output of prepare-ocr's exact core 6.0.0 pin,
    // not npm's transitive core (the lockfile currently resolves that to 6.1.2).
    const preparation = await readFile(new URL('../../scripts/prepare-ocr.mjs', import.meta.url), 'utf8');
    expect(preparation).toContain('tesseract.js-core@6.0.0/${name}');
    const wasmProof = [];
    for (const variant of ['', '-simd', '-lstm', '-simd-lstm']) {
      const name = `tesseract-core${variant}.wasm`;
      const local = await readFile(new URL(`../../public/ocr/core/${name}`, import.meta.url));
      expect(local.length, `${name}: nonempty local build reference`).toBeGreaterThan(8);
      expect(local.subarray(0, 4).toString('hex'), 'WASM magic').toBe('0061736d');
      const response = await page.context().request.get(`/ocr/core/${name}`, { maxRedirects: 0 });
      expect(response.status(), name).toBe(200);
      expect(response.headers()['set-cookie'], 'No API response cookie').toBeUndefined();
      const served = await response.body();
      expect(sha256(served), `${name}: HTTP matches pinned local build`).toBe(sha256(local));
      wasmProof.push({ path: `/ocr/core/${name}`, status: response.status(), sha256: sha256(served), coreVersion: '6.0.0', reference: 'public/ocr/core from scripts/prepare-ocr.mjs' });
      await response.dispose();
    }
    await testInfo.attach('wasm-http-checksums', {
      body: Buffer.from(JSON.stringify(wasmProof, null, 2)), contentType: 'application/json',
    });
    // Successful extraction, edit, confirmation and save above prove OCR continues
    // after the startup eval was blocked, rather than silently allowing eval.
    const csp = await browserValue(page, () => window.__f02Csp);
    expect(classifyCsp(csp).known).toHaveLength(1);
    expect(classifyCsp(csp).unexpected).toEqual([]);
  });
}

test('valid PNG with unreadable display falls back without registration', async ({ page }, testInfo) => {
  const initial = await historyCount(page);
  await openPhoto(page);
  await photo(page).getByLabel('Escolher foto sintética da galeria').setInputFiles(
    await fixture(page, [], 'blank-invalid-display', testInfo));
  await expect(photo(page).getByRole('status')).toHaveText('Leitura indeterminada. Fotografe novamente ou preencha manualmente.');
  await expect(photo(page).getByRole('heading', { name: 'Revisar valores fictícios' })).toHaveCount(0);
  await photo(page).getByRole('button', { name: 'Não consegui ler: preencher manualmente' }).click();
  await expect(photo(page).getByText('Entrada manual', { exact: true })).toBeVisible();
  await expect(photo(page).getByLabel('Glicemia', { exact: true })).toBeEmpty();
  await expect(confirmation(page)).not.toBeChecked();
  await expect(save(page)).toBeDisabled();
  expect(await historyCount(page)).toBe(initial);
});

test('corrupt PNG is rejected without registration and permits manual entry', async ({ page }) => {
  const initial = await historyCount(page);
  await openPhoto(page);
  const camera = photo(page).getByLabel('Fotografar visor sintético');
  await expect(camera).toHaveAttribute('capture', 'environment');
  await expect(camera).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  await camera.setInputFiles({ name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from('synthetic invalid PNG') });
  await expect(photo(page).getByRole('status')).toContainText('Não foi possível ler a imagem.');
  await expect(photo(page).getByRole('heading', { name: 'Revisar valores fictícios' })).toHaveCount(0);
  await photo(page).getByRole('button', { name: 'Não consegui ler: preencher manualmente' }).click();
  await expect(save(page)).toBeDisabled();
  expect(await historyCount(page)).toBe(initial);
});
