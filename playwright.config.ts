import { defineConfig } from '@playwright/test';
import { loadEnv } from './src/config/env';
import { buildProjects } from './src/config/projects';

const env = loadEnv();

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The live dev funnel is occasionally flaky (a tap can land mid-transition
  // and not register), so retry to keep results trustworthy for QA.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : '50%',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results',
  projects: buildProjects(env),
});
