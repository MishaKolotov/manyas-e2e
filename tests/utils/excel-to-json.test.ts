import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { importXlsx, classifyRow } from '../../src/utils/excel-to-json';

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
