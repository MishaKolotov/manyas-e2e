import { test, expect } from '@playwright/test';
import { loadEnv } from '../../src/config/env';

test('loadEnv throws when BASIC_AUTH_USER missing', () => {
  const orig = process.env.BASIC_AUTH_USER;
  delete process.env.BASIC_AUTH_USER;
  try {
    expect(() => loadEnv()).toThrow(/BASIC_AUTH_USER/);
  } finally {
    if (orig !== undefined) process.env.BASIC_AUTH_USER = orig;
  }
});

test('loadEnv returns parsed config when all vars present', () => {
  process.env.BASIC_AUTH_USER = 'user';
  process.env.BASIC_AUTH_PASS = 'pass';
  process.env.BASE_URL = 'https://example.test';
  process.env.SURVEY_PATH = '/survey/';
  process.env.FEATURE_FLAGS = 'stripeV64=true';
  const cfg = loadEnv();
  expect(cfg.basicAuthUser).toBe('user');
  expect(cfg.baseUrl).toBe('https://example.test');
  expect(cfg.featureFlags).toBe('stripeV64=true');
});
