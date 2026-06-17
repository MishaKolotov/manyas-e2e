import { test, expect } from '@playwright/test';
import { CONFIGS, buildConfigUrl, selectedConfigs } from '../../src/config/configs';

const BASE = 'https://dev.slimkit.health';

test('CONFIGS has unique names', () => {
  const names = CONFIGS.map((c) => c.name);
  expect(new Set(names).size).toBe(names.length);
});

test('buildConfigUrl appends the config params and forces variant B', () => {
  const cfg = CONFIGS.find((c) => c.name === 'default')!;
  const url = new URL(buildConfigUrl(cfg, BASE));
  expect(url.pathname).toBe('/walking/survey/');
  expect(url.searchParams.get('stripeV64')).toBe('true');
  expect(url.searchParams.get('AValue')).toBe('0');
  expect(url.searchParams.get('BValue')).toBe('100');
});

test('buildConfigUrl preserves config-specific params', () => {
  const cfg = CONFIGS.find((c) => c.name === 'japanesewalking')!;
  const url = new URL(buildConfigUrl(cfg, BASE));
  expect(url.searchParams.get('config')).toBe('taichiwalking');
  expect(url.searchParams.get('japaneseWalkingMethod')).toBe('true');
});

test('selectedConfigs returns all configs when TEST_CONFIG unset', () => {
  expect(selectedConfigs(undefined)).toHaveLength(CONFIGS.length);
});

test('selectedConfigs filters by TEST_CONFIG', () => {
  const got = selectedConfigs('taichiwalking');
  expect(got).toHaveLength(1);
  expect(got[0].name).toBe('taichiwalking');
});

test('selectedConfigs throws on unknown TEST_CONFIG', () => {
  expect(() => selectedConfigs('nope')).toThrow(/unknown config/i);
});
