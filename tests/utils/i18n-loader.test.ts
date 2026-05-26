import { test, expect } from '@playwright/test';
import { loadTranslations, type Translations } from '../../src/utils/i18n-loader';

test('loadTranslations("en") returns intro_text_0', () => {
  const t: Translations = loadTranslations('en');
  expect(t.get('intro_text_0')).toBe('Walking');
});

test('loadTranslations("ru") returns Ходьба for intro_text_0', () => {
  const t = loadTranslations('ru');
  expect(t.get('intro_text_0')).toBe('Ходьба');
});

test('translations.get throws on missing key', () => {
  const t = loadTranslations('en');
  expect(() => t.get('this_key_does_not_exist_xyz')).toThrow(/missing translation key/i);
});
