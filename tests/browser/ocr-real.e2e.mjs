import { test, expect } from '@playwright/test';

// Real raster pixels, no OCR/parser/worker mocks or injected recognition results.
// Canvas uses a runner-installed font, and no fixture text is sent to the app.
async function fixture(page, lines, name, testInfo) {
  const base64 = await page.evaluate(async (textLines) => {
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

const photo = page => page.getByRole('region', { name: 'Foto do aparelho' });
const confirmation = page => photo(page).getByRole('checkbox', { name: /Conferi e confirmo/ });
const save = page => photo(page).getByRole('button', { name: 'Registrar exemplo confirmado' });
async function historyCount(page) {
  await page.locator('nav').getByRole('button', { name: /Histórico/ }).click();
  return page.locator('tbody tr').count();
}
async function openPhoto(page) {
  await page.getByRole('button', { name: '＋ Nova medição', exact: true }).click();
  await photo(page).getByRole('checkbox', { name: /Declaro que a imagem/ }).check();
}

// Install restrictions before navigation, including traffic initiated by workers.
// SW is blocked so all requests remain observable/routable. This is not a SW test.
test.beforeEach(async ({ context, page }, testInfo) => {
  const external = [], writes = [], assets = [], errors = [];
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
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
  context.on('response', response => {
    if (new URL(response.url()).pathname.startsWith('/ocr/')) {
      assets.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error' || /content.security.policy|permissions.policy|camera/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.addInitScript(() => {
    window.__f02Csp = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.__f02Csp.push({ directive: event.violatedDirective, blockedURI: event.blockedURI });
    });
  });
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toContain("connect-src 'self'");
  expect(response.headers()['content-security-policy']).toContain("worker-src 'self'");
  expect(response.headers()['permissions-policy']).toContain('camera=(self)');
  await expect(page.getByText(/AMBIENTE DEMONSTRATIVO/)).toBeVisible();
  // Teardown runs even if OCR fails, preserving diagnostics and privacy failures.
  testInfo._f02 = { external, writes, assets, errors };
});

test.afterEach(async ({ page }, testInfo) => {
  const audit = testInfo._f02;
  if (!audit) return;
  const csp = await page.evaluate(() => window.__f02Csp);
  await testInfo.attach('browser-audit', {
    body: Buffer.from(JSON.stringify({ ...audit, csp }, null, 2)), contentType: 'application/json',
  });
  expect(audit.external, 'No attempt to contact third parties').toEqual([]);
  expect(audit.writes, 'No image upload or backend write').toEqual([]);
  expect(csp, 'No runtime CSP violations').toEqual([]);
  expect(audit.errors, 'No console errors, camera/policy warnings or uncaught errors').toEqual([]);
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
    expect(assets.some(a => /\/ocr\/core\/.*\.wasm$/.test(new URL(a.url).pathname) && a.status === 200)).toBe(true);
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
