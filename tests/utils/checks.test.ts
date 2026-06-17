import { test, expect } from '@playwright/test';
import { looksLikeLeakedKey } from '../../src/utils/checks';

test('flags snake_case and camelCase i18n keys', () => {
  expect(looksLikeLeakedKey('intro_text_0')).toBe(true);
  expect(looksLikeLeakedKey('fitnesLevel_title')).toBe(true);
  expect(looksLikeLeakedKey('sheet2.what_do_you_want')).toBe(true);
});

test('flags {{placeholder}} syntax', () => {
  expect(looksLikeLeakedKey('Hello {{name}}')).toBe(true);
});

test('does not flag normal translated copy', () => {
  expect(looksLikeLeakedKey('Walking')).toBe(false);
  expect(looksLikeLeakedKey('Ходьба')).toBe(false);
  expect(looksLikeLeakedKey('What do you want?')).toBe(false);
  expect(looksLikeLeakedKey('12,99 €')).toBe(false);
  expect(looksLikeLeakedKey('email')).toBe(false);
});
