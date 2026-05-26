import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { LocaleCode } from '../config/locales';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../../tests/fixtures/i18n');

export interface Translations {
  readonly locale: LocaleCode;
  get(key: string): string;
  has(key: string): boolean;
  raw(): Record<string, string>;
}

const cache = new Map<LocaleCode, Translations>();

export function loadTranslations(locale: LocaleCode): Translations {
  const hit = cache.get(locale);
  if (hit) return hit;
  const file = path.join(FIXTURES_DIR, `${locale}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Translations file missing: ${file}. Run \`npm run i18n:import\`.`);
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
  const t: Translations = {
    locale,
    get(key) {
      const v = data[key];
      if (v == null || v === '') {
        throw new Error(`Missing translation key '${key}' in locale '${locale}'`);
      }
      return v;
    },
    has: (key) => !!data[key],
    raw: () => ({ ...data }),
  };
  cache.set(locale, t);
  return t;
}
