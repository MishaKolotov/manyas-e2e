import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { importXlsx, classifyRow, normalizeValue, slugifyEnglish } from '../../src/utils/excel-to-json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, '__importer-test-input.xlsx');

test('importXlsx throws if xlsx is missing', () => {
  expect(() => importXlsx('/tmp/does-not-exist.xlsx', os.tmpdir())).toThrow(
    /Place .* in repo root/i,
  );
});

test('importXlsx throws if Sheet1 lacks required column', () => {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([['key', 'en', 'ru']]),
    'Sheet1',
  );
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([[]]), 'Sheet2');
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([
      ['key', 'en', 'fr', 'it', 'es', 'ja', 'ru', 'de', 'pt', 'zh', 'ko'],
    ]),
    'Sheet3',
  );
  const tmpFile = path.join(os.tmpdir(), `bad-${Date.now()}.xlsx`);
  xlsx.writeFile(wb, tmpFile);
  try {
    expect(() => importXlsx(tmpFile, os.tmpdir())).toThrow(
      /Sheet1 missing required column: 'fr'/,
    );
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('classifyRow: empty key → EMPTY', () => {
  expect(classifyRow('', { en: 'x' })).toBe('EMPTY');
});

test('classifyRow: empty en → EMPTY', () => {
  expect(classifyRow('intro_text_0', { en: '' })).toBe('EMPTY');
});

test('classifyRow: whitespace-only en → EMPTY', () => {
  expect(classifyRow('intro_text_0', { en: '   \t  ' })).toBe('EMPTY');
});

test('classifyRow: !!! marker → MARKER', () => {
  expect(classifyRow('Note!!!', { en: 'x' })).toBe('MARKER');
});

test('classifyRow: emoji in key → EMOJI', () => {
  expect(classifyRow('intro 🎉 text', { en: 'x' })).toBe('EMOJI');
});

test('classifyRow: cyrillic key with only ru filled → RU_NOTE', () => {
  expect(
    classifyRow('Важная заметка', {
      en: '',
      ru: 'note',
      fr: '',
      de: '',
      it: '',
      pt: '',
      es: '',
      zh: '',
      ja: '',
      ko: '',
    }),
  ).toBe('RU_NOTE');
});

test('classifyRow: normal key → ACCEPT', () => {
  expect(classifyRow('intro_text_0', { en: 'Walking', ru: 'Ходьба' })).toBe(
    'ACCEPT',
  );
});

test('classifyRow: camelCase key → ACCEPT', () => {
  expect(
    classifyRow('fitnesLevel_title', { en: "What's your level?" }),
  ).toBe('ACCEPT');
});

test('normalizeValue: replaces NBSP with regular space', () => {
  expect(normalizeValue('Hello World')).toBe('Hello World');
});

test('normalizeValue: replaces ⏎ glyph with newline', () => {
  expect(normalizeValue('Line1 ⏎ Line2')).toBe('Line1 \n Line2');
});

test('normalizeValue: trims edges', () => {
  expect(normalizeValue('  spaced  ')).toBe('spaced');
});

test('slugifyEnglish: basic phrase', () => {
  expect(slugifyEnglish('What do you want?')).toBe('what_do_you_want');
});

test('slugifyEnglish: collapses repeated underscores', () => {
  expect(slugifyEnglish('A — B - C')).toBe('a_b_c');
});

test('slugifyEnglish: handles trailing punctuation', () => {
  expect(slugifyEnglish('Hello!!!')).toBe('hello');
});

test('importXlsx against fixture produces correct JSONs and meta', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-out-'));
  const result = importXlsx(FIXTURE, outDir);

  // Expected from fixture:
  // - intro_text_0, intro_text_1, paywall_title — accepted from Sheet1/Sheet3
  // - sheet2.what_do_you_want — from Sheet2
  // - "ВАЖНАЯ ИНФОРМАЦИЯ !!!!" — skipped MARKER
  // - "" + "orphan en value" — skipped EMPTY
  expect(result.totalKeys).toBe(4);

  const enPath = path.join(outDir, 'en.json');
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  expect(en.intro_text_0).toBe('Walking');
  expect(en.intro_text_1).toBe('Lose weight');
  expect(en.paywall_title).toBe('Get started');
  expect(en['sheet2.what_do_you_want']).toBe('What do you want?');

  const ru = JSON.parse(fs.readFileSync(path.join(outDir, 'ru.json'), 'utf8'));
  expect(ru.intro_text_0).toBe('Ходьба');

  const meta = JSON.parse(fs.readFileSync(path.join(outDir, '_meta.json'), 'utf8'));
  expect(meta.totalKeys).toBe(4);
  expect(meta.skippedRows.length).toBeGreaterThan(0);
  expect(meta.skippedRows.some((r: any) => r.category === 'MARKER')).toBe(true);
  expect(meta.skippedRows.some((r: any) => r.category === 'EMPTY')).toBe(true);
});

test('importXlsx: cross-sheet duplicate — Sheet3 wins, key logged', () => {
  const wb = xlsx.utils.book_new();
  const header = ['key', 'en', 'fr', 'it', 'es', 'ja', 'ru', 'de', 'pt', 'zh', 'ko'];
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([header, ['dup_key', 'A', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a']]),
    'Sheet1',
  );
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([['English', 'Russian', 'French', 'German', 'Italian', 'Portuguese', 'Spanish', 'Chinese', 'Japanese', 'Korean']]),
    'Sheet2',
  );
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([header, ['dup_key', 'B', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b']]),
    'Sheet3',
  );
  const tmp = path.join(os.tmpdir(), `cross-dup-${Date.now()}.xlsx`);
  xlsx.writeFile(wb, tmp);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-cross-'));
  try {
    const result = importXlsx(tmp, outDir);
    // Sheet3 is iterated first → its 'B' wins, Sheet1's 'A' is logged as a dup.
    const en = JSON.parse(fs.readFileSync(path.join(outDir, 'en.json'), 'utf8'));
    expect(en.dup_key).toBe('B');
    expect(result.duplicateKeys).toContain('dup_key');
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('importXlsx: fails loud on within-sheet duplicate', () => {
  const wb = xlsx.utils.book_new();
  const header = ['key', 'en', 'fr', 'it', 'es', 'ja', 'ru', 'de', 'pt', 'zh', 'ko'];
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([
      header,
      ['dup_within', 'A', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'],
      ['dup_within', 'B', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b'],
    ]),
    'Sheet1',
  );
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([['English', 'Russian', 'French', 'German', 'Italian', 'Portuguese', 'Spanish', 'Chinese', 'Japanese', 'Korean']]),
    'Sheet2',
  );
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([header]),
    'Sheet3',
  );
  const tmp = path.join(os.tmpdir(), `within-dup-${Date.now()}.xlsx`);
  xlsx.writeFile(wb, tmp);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-within-'));
  try {
    expect(() => importXlsx(tmp, outDir)).toThrow(
      /appears more than once within Sheet1/,
    );
  } finally {
    fs.unlinkSync(tmp);
  }
});
