import { defineConfig } from '@playwright/test';
import { loadEnv } from './src/config/env';
import { buildProjects } from './src/config/projects';

const env = loadEnv();

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
