import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { importXlsx } from '../../src/utils/excel-to-json';

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
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([[]]), 'Sheet3');
  const tmpFile = path.join(os.tmpdir(), `bad-${Date.now()}.xlsx`);
  xlsx.writeFile(wb, tmpFile);
  try {
    expect(() => importXlsx(tmpFile, os.tmpdir())).toThrow(
      /missing required column/i,
    );
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
