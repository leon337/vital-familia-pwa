import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { writeEvidence } from './audit-artifacts.mjs';
import { classifyCsp, expectedCsp, knownEvalDiagnostic, classifyRequest } from './helpers/csp-audit.mjs';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Direct CDP evaluation avoids Playwright's main-world UtilityScript eval probe.
// CSP remains enforced; every CSP violation fails closed.
async function browserValue(page, fn, arg) {
  const { result, exceptionDetails } = await page.__f02Session.send('Runtime.evaluate', {
    expression: `(${fn.toString()})(${JSON.stringify(arg) ?? 'undefined'})`,
    awaitPromise: true, returnByValue: true, allowUnsafeEvalBlockedByCSP: false,
  });
  if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
  return result.value;
}

async function isolationSnapshot(page) {
  return browserValue(page, async () => ({
    serviceWorkerRegistrations: (await navigator.serviceWorker.getRegistrations()).map(registration => registration.scope),
    serviceWorkerController: navigator.serviceWorker.controller?.scriptURL ?? null,
    cacheStorage: await caches.keys(),
  }));
}

function expectIsolation(snapshot) {
  expect.soft(snapshot.serviceWorkerRegistrations, 'No service worker registrations').toEqual([]);
  expect.soft(snapshot.serviceWorkerController, 'No controlling service worker').toBeNull();
  expect.soft(snapshot.cacheStorage, 'CacheStorage remains empty').toEqual([]);
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
  await writeEvidence(testInfo, `${name}.png`, buffer, 'image/png');
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
  const external = [], writes = [], assets = [], errors = [], cookieHeaders = [], security = [], failedRequests = [], csp = [], rejectedRequests = [], requests = [];
  // Register audit before setup assertions so setup failures also retain evidence.
  testInfo._f02 = { external, writes, assets, errors, cookieHeaders, security, failedRequests, csp, rejectedRequests, requests };
  const audit = testInfo._f02;
  const receipt = JSON.parse(await readFile('test-results/f02-build-receipt.json', 'utf8'));
  const expectedAssets = new Map(receipt.files.map(file => [file.path.replace(/^\.next\/static\//, '/_next/static/').replace(/^public\//, '/'), file.sha256]));
  const pendingResponses = [];
  audit.pendingResponses = pendingResponses;
  audit.buildMismatches = [];
  await context.exposeBinding('__f02AuditSink', ({ frame }, value) => {
    if (frame !== page.mainFrame()) throw new Error('Unexpected audit frame');
    if (value.kind === 'ready') { audit.ready = true; return; }
    csp.push(Object.freeze({ ...value, sequence: csp.length, phase: audit.baseline ? 'image-handling' : 'navigation' }));
  });
  page.__f02Session = await context.newCDPSession(page);
  page.__f02Session.on('Log.entryAdded', ({ entry }) => {
    if (entry.source === 'security') security.push(entry);
  });
  await page.__f02Session.send('Log.enable');
  await context.routeWebSocket('**/*', socket => {
    external.push({ channel: 'WebSocket' });
    socket.close();
  });
  context.on('requestfailed', request => failedRequests.push({
    ...classifyRequest(request.url(), request.method(), !!request.postDataBuffer(), expectedAssets),
  }));
  await context.route('**/*', async route => {
    const request = route.request();
    const metadata = classifyRequest(request.url(), request.method(), !!request.postDataBuffer(), expectedAssets);
    // Classify every attempt before aborting, including external GET/HEAD.
    requests.push(metadata);
    if (metadata.external) external.push(metadata);
    if (metadata.write) writes.push(metadata);
    if (!metadata.allowed) {
      rejectedRequests.push(metadata);
      return route.abort('blockedbyclient');
    }
    const headers = await request.allHeaders();
    if (headers.cookie) cookieHeaders.push({ direction: 'request' });
    await route.continue();
  });
  context.on('response', response => {
    const task = (async () => {
    const expectedHash = expectedAssets.get(new URL(response.url()).pathname);
    if (expectedHash && (response.status() !== 200 || sha256(await response.body()) !== expectedHash)) {
      audit.buildMismatches.push({ url: response.url(), status: response.status() });
    }
    if ((await response.headersArray()).some(header => header.name.toLowerCase() === 'set-cookie')) {
      cookieHeaders.push({ direction: 'response', url: response.url() });
    }
    if (new URL(response.url()).pathname.startsWith('/ocr/')) {
      assets.push({ url: response.url(), status: response.status() });
    }
    })().catch(error => audit.buildMismatches.push({ error: String(error) }));
    pendingResponses.push(task);
  });
  page.on('pageerror', error => errors.push({ text: String(error), url: undefined }));
  page.on('console', message => {
    if (true) {
      errors.push({ text: message.text(), url: message.location().url });
    }
  });
  await page.addInitScript(() => {
    const sink = window.__f02AuditSink;
    document.addEventListener('securitypolicyviolation', event => {
      void sink({ kind: 'csp', isTrusted: event.isTrusted,
        directive: event.violatedDirective, effectiveDirective: event.effectiveDirective,
        blockedURI: event.blockedURI, sourceFile: event.sourceFile,
        lineNumber: event.lineNumber, columnNumber: event.columnNumber,
        sample: event.sample, disposition: event.disposition,
        originalPolicy: event.originalPolicy, time: performance.now() });
    }, true);
    void sink({ kind: 'ready' });
  });
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response.headers()['content-security-policy'], 'Enforced product CSP must remain unchanged').toBe(expectedCsp);
  expect(response.headers()['content-security-policy']).not.toMatch(/(?:^|\s)'unsafe-eval'(?:\s|;|$)/);
  expect(response.headers()['content-security-policy']).toContain("connect-src 'self'");
  expect(response.headers()['content-security-policy']).toContain("worker-src 'self'");
  expect(response.headers()['permissions-policy']).toContain('camera=(self)');
  await expect(page.getByText(/AMBIENTE DEMONSTRATIVO/)).toBeVisible();
  await expect.poll(() => audit.ready).toBe(true);
  audit.isolationBefore = await isolationSnapshot(page);
  audit.baseline = Object.freeze({ cspCount: csp.length, securityCount: security.length, errorsCount: errors.length });
  await writeEvidence(testInfo, 'navigation-baseline.json', Buffer.from(JSON.stringify({ baseline: audit.baseline, isolationBefore: audit.isolationBefore, csp, security, errors })), 'application/json');
  expectIsolation(audit.isolationBefore);
  // Do not excuse an event even if it matches the previously reported Next chunk.
  expect.soft(csp, 'Navigation CSP must be empty; cause is unauthenticated').toEqual([]);
});

test.afterEach(async ({ context, page }, testInfo) => {
  const audit = testInfo._f02;
  let browser, storage, classification, unexpectedSecurity, unexpectedErrors, collectionError;
  try {
    if (!audit) throw new Error('Audit setup did not initialize');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await Promise.all(audit.pendingResponses ?? []);
    browser = await browserValue(page, async () => ({
      sessionStorage: Object.keys(sessionStorage),
      localStorage: Object.keys(localStorage), indexedDB: await indexedDB.databases(),
    }));
    audit.isolationAfter = await isolationSnapshot(page);
    expectIsolation(audit.isolationAfter);
    const { csp } = audit;
    classification = classifyCsp(csp);
    unexpectedSecurity = audit.security.filter(entry => !knownEvalDiagnostic(entry.text, entry.url, classification));
    unexpectedErrors = audit.errors.filter(message => !knownEvalDiagnostic(message.text, message.url, classification));
    storage = { cookies: await context.cookies() };
    expect.soft(audit.buildMismatches, 'Served assets match this exact build receipt').toEqual([]);
    expect.soft(audit.ready, 'Collector installed before navigation').toBe(true);
    expect.soft(csp.every(event => event.isTrusted === true), 'Reject synthetic CSP events').toBe(true);
    expect.soft(csp.length, 'No extra CSP events during image handling').toBe(audit.baseline?.cspCount);
    expect.soft(audit.failedRequests, 'No failed requests').toEqual([]);
    expect.soft(audit.rejectedRequests, 'No unapproved paths, URL values, bodies or methods').toEqual([]);
    expect.soft(storage.cookies, 'No cookies, including HttpOnly/third-party cookies').toEqual([]);
    expect.soft(browser.localStorage, 'No persistent local data').toEqual([]);
    expect.soft(browser.indexedDB, 'No persisted OCR/clinical database').toEqual([]);
    expect.soft(browser.sessionStorage, 'No session persistence').toEqual([]);
    expect.soft(audit.cookieHeaders, 'No cookie exchange').toEqual([]);
    expect.soft(audit.external, 'No attempt to contact third parties').toEqual([]);
    expect.soft(audit.writes, 'No image upload or backend write').toEqual([]);
    expect.soft(classification.known, 'No authenticated eval exemption exists').toEqual([]);
    expect.soft(classification.unexpected, 'All other CSP violations fail').toEqual([]);
    expect.soft(unexpectedSecurity, 'No other browser security diagnostics (including workers)').toEqual([]);
    expect.soft(unexpectedErrors, 'No other console errors, camera/policy warnings or uncaught errors').toEqual([]);
  } catch (error) {
    collectionError = error;
    throw error;
  } finally {
    // Persist Node-side evidence even if networkidle, CDP, cookies or assertions fail.
    // An abrupt process termination cannot run finally; the finalizer rejects missing files.
    try {
      await writeEvidence(testInfo, 'browser-audit.json', Buffer.from(JSON.stringify({
        ...audit, pendingResponses: undefined, ...browser, storage, classification,
        unexpectedSecurity, unexpectedErrors,
        collectionError: collectionError ? { message: String(collectionError), stack: collectionError.stack } : null,
        testErrors: testInfo.errors.map(error => ({ message: error.message, stack: error.stack })),
      }, null, 2)), 'application/json');
    } catch (persistenceError) {
      if (collectionError) throw new AggregateError([collectionError, persistenceError], 'Audit collection and persistence failed');
      throw persistenceError;
    }
  }
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
    await writeEvidence(testInfo, 'wasm-http-checksums.json', Buffer.from(JSON.stringify(wasmProof, null, 2)), 'application/json');
    // Successful extraction, edit, confirmation and save above prove OCR continues
    // with the enforced CSP, whether or not Next attempts the startup eval.
    const csp = testInfo._f02.csp;
    expect(csp.length).toBe(testInfo._f02.baseline.cspCount);
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

test('corrupt PNG is rejected without registration and permits manual entry', async ({ page }, testInfo) => {
  const initial = await historyCount(page);
  await openPhoto(page);
  const camera = photo(page).getByLabel('Fotografar visor sintético');
  await expect(camera).toHaveAttribute('capture', 'environment');
  await expect(camera).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  const corrupt = Buffer.from('synthetic invalid PNG');
  await writeEvidence(testInfo, 'corrupt.png', corrupt, 'image/png');
  await camera.setInputFiles({ name: 'corrupt.png', mimeType: 'image/png', buffer: corrupt });
  await expect(photo(page).getByRole('status')).toContainText('Não foi possível ler a imagem.');
  await expect(photo(page).getByRole('heading', { name: 'Revisar valores fictícios' })).toHaveCount(0);
  await photo(page).getByRole('button', { name: 'Não consegui ler: preencher manualmente' }).click();
  await expect(save(page)).toBeDisabled();
  expect(await historyCount(page)).toBe(initial);
});
