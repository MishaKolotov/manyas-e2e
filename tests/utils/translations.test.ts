import { test, expect } from '@playwright/test';
import { loadTranslations } from '../../src/utils/translations';

test('loads a locale map and resolves keys', () => {
  const t = loadTranslations('en');
  expect(typeof t.t('intro_text_0')).toBe('string');
  expect(t.t('intro_text_0').length).toBeGreaterThan(0);
});

test('throws a clear error for a missing key', () => {
  const t = loadTranslations('en');
  expect(() => t.t('definitely_missing_key_xyz')).toThrow(/missing translation key/i);
});

test('has returns false for unknown key without throwing', () => {
  const t = loadTranslations('en');
  expect(t.has('definitely_missing_key_xyz')).toBe(false);
  expect(t.has('intro_text_0')).toBe(true);
});
