import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: '50%',
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
