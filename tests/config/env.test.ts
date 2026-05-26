import { test, expect } from '@playwright/test';
import { loadEnv } from '../../src/config/env';

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const snapshot: Record<string, string | undefined> = {};
  for (const k of Object.keys(overrides)) snapshot[k] = process.env[k];
  try {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of Object.entries(snapshot)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('loadEnv throws when BASIC_AUTH_USER missing', () => {
  withEnv({ BASIC_AUTH_USER: undefined }, () => {
    expect(() => loadEnv()).toThrow(/BASIC_AUTH_USER/);
  });
});

test('loadEnv error lists every missing var', () => {
  withEnv({ BASIC_AUTH_USER: undefined, BASIC_AUTH_PASS: undefined }, () => {
    expect(() => loadEnv()).toThrow(
      /BASIC_AUTH_USER.*BASIC_AUTH_PASS|BASIC_AUTH_PASS.*BASIC_AUTH_USER/,
    );
  });
});

test('loadEnv returns parsed config when all vars present', () => {
  withEnv(
    {
      BASIC_AUTH_USER: 'user',
      BASIC_AUTH_PASS: 'pass',
      BASE_URL: 'https://example.test',
      SURVEY_PATH: '/survey/',
      FEATURE_FLAGS: 'stripeV64=true',
    },
    () => {
      const cfg = loadEnv();
      expect(cfg.basicAuthUser).toBe('user');
      expect(cfg.baseUrl).toBe('https://example.test');
      expect(cfg.featureFlags).toBe('stripeV64=true');
    },
  );
});
