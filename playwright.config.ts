import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

const fixtureToken = process.env.STUDY_E2E_RUN_ID ?? randomUUID();
process.env.STUDY_E2E_RUN_ID = fixtureToken;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  globalTeardown: './tests/fixtures/teardown.ts',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    launchOptions: process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
      ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {},
    headless: true,
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node .test-build/tests/fixtures/server.js',
    url: 'http://127.0.0.1:4174/',
    reuseExistingServer: false,
    env: { STUDY_E2E_RUN_ID: fixtureToken },
    timeout: 20_000,
  },
});
