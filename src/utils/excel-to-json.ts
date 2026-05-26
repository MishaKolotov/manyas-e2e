import * as fs from 'fs';
import * as path from 'path';
import xlsx, { type WorkSheet } from 'xlsx';

const REQUIRED_LOCALE_COLS = [
  'en', 'fr', 'it', 'es', 'ja', 'ru', 'de', 'pt', 'zh', 'ko',
] as const;

export interface ImportResult {
  totalKeys: number;
  perLocale: Record<string, { translated: number; missingKeys: string[] }>;
  skippedRows: Array<{
    sheet: string;
    rowIndex: number;
    key: string;
    category: 'EMPTY' | 'MARKER' | 'EMOJI' | 'RU_NOTE';
    sampleValues: { en: string; ru: string };
  }>;
  duplicateKeys: string[];
}

function validateSheetSchema(
  sheet: WorkSheet,
  sheetName: string,
  requireKeyCol: boolean,
): void {
  const rows = xlsx.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  if (rows.length === 0) {
    throw new Error(`${sheetName} is empty`);
  }
  const header = rows[0].map((h) => String(h).trim());
  if (requireKeyCol && !header.includes('key')) {
    throw new Error(
      `${sheetName} missing required column: 'key'. Did the localization team rename/remove it?`,
    );
  }
  for (const col of REQUIRED_LOCALE_COLS) {
    if (!header.includes(col)) {
      throw new Error(
        `${sheetName} missing required column: '${col}'. Did the localization team rename/remove it?`,
      );
    }
  }
}

export function importXlsx(xlsxPath: string, outDir: string): ImportResult {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(
      `Place WWLI Onboarding Localisation.xlsx in repo root. Looked for: ${xlsxPath}`,
    );
  }
  const wb = xlsx.readFile(xlsxPath);
  for (const required of ['Sheet1', 'Sheet2', 'Sheet3']) {
    if (!wb.SheetNames.includes(required)) {
      throw new Error(`Workbook at ${xlsxPath} missing sheet: ${required}`);
    }
  }
  validateSheetSchema(wb.Sheets['Sheet1'], 'Sheet1', true);
  validateSheetSchema(wb.Sheets['Sheet3'], 'Sheet3', true);
  // Sheet2 has a different header shape (full language names like "English",
  // "Russian" instead of locale codes) and no 'key' column, so it cannot use
  // the same validator. Task 6 will add a Sheet2-specific reader that handles
  // the schema differences inline.

  // TODO Task 6+: row processing, normalization, output

  // Stub: ensure outDir exists and return empty result for now
  fs.mkdirSync(outDir, { recursive: true });
  return {
    totalKeys: 0,
    perLocale: {},
    skippedRows: [],
    duplicateKeys: [],
  };
}
