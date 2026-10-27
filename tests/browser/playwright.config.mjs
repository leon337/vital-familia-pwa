import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 150_000,
  expect: { timeout: 55_000 },
  outputDir: '../../test-results/f02',
  reporter: [['./audit-reporter.mjs'], ['json', { outputFile: 'test-results/f02/results.json' }], ['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block',
    trace: 'on',
    screenshot: 'on',
  },
  webServer: {
    command: 'npm run start -- --hostname 127.0.0.1',
    cwd: new URL('../..', import.meta.url).pathname,
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { NEXT_TELEMETRY_DISABLED: '1', SYNTHETIC_BACKEND_ENABLED: 'false' },
  },
});
