import { test, expect } from '@playwright/test';
import { SUPPORTED_LOCALES, getLocale } from '../../src/config/locales';

test('SUPPORTED_LOCALES contains exactly 10 in-scope languages', () => {
  const codes = SUPPORTED_LOCALES.map((l) => l.code).sort();
  expect(codes).toEqual(['de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'ru', 'zh']);
});

test('every locale has BCP-47 tag and timezone', () => {
  for (const loc of SUPPORTED_LOCALES) {
    expect(loc.bcp47).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    expect(loc.timezone).toMatch(/^[A-Z][a-zA-Z_]+\/[A-Z][a-zA-Z_]+$/);
  }
});

test('getLocale("ru") returns ru-RU descriptor', () => {
  const ru = getLocale('ru');
  expect(ru.bcp47).toBe('ru-RU');
  expect(ru.timezone).toBe('Europe/Moscow');
});

test('getLocale("xx") throws', () => {
  expect(() => getLocale('xx' as any)).toThrow(/Unknown locale/);
});
