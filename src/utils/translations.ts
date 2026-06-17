import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { LocaleCode } from '../config/locales';

const here = dirname(fileURLToPath(import.meta.url));
const TRANSLATIONS_DIR = join(here, '..', '..', 'tests', 'translations');

export interface Translations {
  locale: LocaleCode;
  /** Returns the translation, throwing if the key is absent. */
  t(key: string): string;
  /** True if the key exists. */
  has(key: string): boolean;
  /** Raw flat map for reverse lookups (e.g. EN-fallback heuristic). */
  all(): Record<string, string>;
}

export function loadTranslations(locale: LocaleCode): Translations {
  const file = join(TRANSLATIONS_DIR, `${locale}.json`);
  let map: Record<string, string>;
  try {
    map = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
  } catch {
    throw new Error(
      `Cannot read translations for "${locale}" at ${file}. Run \`npm run i18n:import\`.`,
    );
  }
  return {
    locale,
    t(key) {
      if (!(key in map)) {
        throw new Error(`Missing translation key "${key}" for locale "${locale}".`);
      }
      return map[key];
    },
    has: (key) => key in map,
    all: () => map,
  };
}
