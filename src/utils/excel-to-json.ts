import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import xlsx, { type WorkSheet } from 'xlsx';

const REQUIRED_LOCALE_COLS = ['en', 'fr', 'it', 'es', 'ja', 'ru', 'de', 'pt', 'zh', 'ko'] as const;

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

function validateSheetSchema(sheet: WorkSheet, sheetName: string, requireKeyCol: boolean): void {
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

export type RowCategory = 'EMPTY' | 'MARKER' | 'EMOJI' | 'RU_NOTE' | 'ACCEPT';

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const CYRILLIC_RE = /[Ѐ-ӿ]/;
const MARKER_RE = /[!?]{2,}/;

export function classifyRow(
  key: string,
  values: Partial<Record<(typeof REQUIRED_LOCALE_COLS)[number], string>>,
): RowCategory {
  const k = String(key).trim();
  if (!k) return 'EMPTY';
  if (MARKER_RE.test(k)) return 'MARKER';
  if (EMOJI_RE.test(k)) return 'EMOJI';
  // Rows whose key is in Cyrillic and where no language column other than `ru`
  // is filled are internal Russian-language notes left by the localization
  // team (e.g. "ВАЖНАЯ ИНФОРМАЦИЯ"). They are not translations and must be
  // skipped before we hit the empty-`en` rule below.
  if (CYRILLIC_RE.test(k)) {
    const nonRuFilled = REQUIRED_LOCALE_COLS.filter(
      (c) => c !== 'ru' && values[c] && String(values[c]).trim() !== '',
    );
    if (nonRuFilled.length === 0) return 'RU_NOTE';
  }
  if (!values.en || !String(values.en).trim()) return 'EMPTY';
  return 'ACCEPT';
}

export function normalizeValue(raw: string): string {
  return String(raw).replace(/ /g, ' ').replace(/⏎/g, '\n').trim();
}

export function slugifyEnglish(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function readKeyedSheet(
  sheet: WorkSheet,
  sheetName: string,
): Array<{ key: string; values: Record<string, string>; rowIndex: number }> {
  const rows = xlsx.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  const header = rows[0].map((h) => String(h).trim());
  const keyIdx = header.indexOf('key');
  const localeIdx: Record<string, number> = {};
  for (const c of REQUIRED_LOCALE_COLS) localeIdx[c] = header.indexOf(c);
  const out: Array<{ key: string; values: Record<string, string>; rowIndex: number }> = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const key = String(row[keyIdx] ?? '');
    const values: Record<string, string> = {};
    for (const c of REQUIRED_LOCALE_COLS) {
      values[c] = String(row[localeIdx[c]] ?? '');
    }
    out.push({ key, values, rowIndex: i });
  }
  // suppress unused parameter warning
  void sheetName;
  return out;
}

function readSheet2(
  sheet: WorkSheet,
): Array<{ key: string; values: Record<string, string>; rowIndex: number }> {
  const rows = xlsx.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const englishIdx = header.indexOf('english');
  if (englishIdx === -1) return [];
  // header names → locale codes (Sheet2 uses language names not codes)
  const nameToCode: Record<string, string> = {
    english: 'en',
    russian: 'ru',
    french: 'fr',
    german: 'de',
    italian: 'it',
    portuguese: 'pt',
    spanish: 'es',
    chinese: 'zh',
    japanese: 'ja',
    korean: 'ko',
  };
  const localeIdx: Record<string, number> = {};
  for (const c of REQUIRED_LOCALE_COLS) {
    const name = Object.entries(nameToCode).find(([, code]) => code === c)?.[0];
    localeIdx[c] = name ? header.indexOf(name) : -1;
  }
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const englishText = String(row[englishIdx] ?? '').trim();
    if (!englishText) continue;
    const key = `sheet2.${slugifyEnglish(englishText)}`;
    const values: Record<string, string> = {};
    for (const c of REQUIRED_LOCALE_COLS) {
      values[c] = localeIdx[c] >= 0 ? String(row[localeIdx[c]] ?? '') : '';
    }
    out.push({ key, values, rowIndex: i });
  }
  return out;
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

  const sheet1Rows = readKeyedSheet(wb.Sheets['Sheet1'], 'Sheet1');
  const sheet3Rows = readKeyedSheet(wb.Sheets['Sheet3'], 'Sheet3');
  const sheet2Rows = readSheet2(wb.Sheets['Sheet2']);

  const skippedRows: ImportResult['skippedRows'] = [];
  const duplicateKeys: string[] = []; // any cross-sheet duplicate, same- or diff-value
  const accepted: Record<string, Record<string, string>> = {}; // key → locale → value
  const seenIn: Record<string, string> = {}; // key → sheet

  // Iteration order matters: Sheet3 is the newer revision of the table and
  // wins on cross-sheet conflicts (verified empirically — the live app uses
  // Sheet3's text for the three keys that disagree with Sheet1). Sheet2 has
  // its own keyspace (sheet2.*), so order vs the others doesn't matter.
  for (const [sheetName, rows] of [
    ['Sheet3', sheet3Rows] as const,
    ['Sheet1', sheet1Rows] as const,
    ['Sheet2', sheet2Rows] as const,
  ]) {
    const seenInThisSheet = new Map<string, string>(); // key → normalized en
    for (const r of rows) {
      const cat = classifyRow(r.key, r.values);
      if (cat !== 'ACCEPT') {
        skippedRows.push({
          sheet: sheetName,
          rowIndex: r.rowIndex,
          key: r.key,
          category: cat,
          sampleValues: { en: r.values.en ?? '', ru: r.values.ru ?? '' },
        });
        continue;
      }
      const thisEn = normalizeValue(r.values.en ?? '');
      const earlierEn = seenInThisSheet.get(r.key);
      if (earlierEn !== undefined) {
        if (earlierEn === thisEn) {
          // Same-value within-sheet duplicate: benign copy-paste (Sheet2 has
          // five of these). Log it and keep the first row.
          duplicateKeys.push(r.key);
          continue;
        }
        // Different-value within-sheet duplicate is a real authoring bug —
        // one key cannot map to two distinct translations. Fail loud.
        throw new Error(
          `Duplicate key '${r.key}' appears more than once within ${sheetName} ` +
            `with conflicting en values ('${earlierEn}' vs '${thisEn}'). ` +
            `Resolve by removing one row in xlsx.`,
        );
      }
      seenInThisSheet.set(r.key, thisEn);

      if (accepted[r.key] && seenIn[r.key] !== sheetName) {
        // Cross-sheet duplicate. The earlier-iterated sheet wins (per the
        // order above, Sheet3 wins over Sheet1). Just log it; same-value and
        // different-value cross-sheet dups are both treated as benign.
        duplicateKeys.push(r.key);
        continue;
      }
      accepted[r.key] = {};
      seenIn[r.key] = sheetName;
      for (const c of REQUIRED_LOCALE_COLS) {
        accepted[r.key][c] = normalizeValue(r.values[c] ?? '');
      }
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  const perLocale: ImportResult['perLocale'] = {};
  for (const c of REQUIRED_LOCALE_COLS) {
    const localeMap: Record<string, string> = {};
    const missingKeys: string[] = [];
    for (const [key, vals] of Object.entries(accepted)) {
      const v = vals[c];
      if (!v) missingKeys.push(key);
      localeMap[key] = v ?? '';
    }
    fs.writeFileSync(path.join(outDir, `${c}.json`), JSON.stringify(localeMap, null, 2) + '\n');
    perLocale[c] = { translated: Object.keys(localeMap).length - missingKeys.length, missingKeys };
  }

  const meta = {
    importedAt: new Date().toISOString(),
    source: path.basename(xlsxPath),
    totalKeys: Object.keys(accepted).length,
    perLocale,
    skippedRows,
    duplicateKeys,
  };
  fs.writeFileSync(path.join(outDir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');

  return { totalKeys: meta.totalKeys, perLocale, skippedRows, duplicateKeys };
}

// CLI entrypoint (when run directly via tsx)
if (import.meta.url && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  const xlsxPath = path.join(process.cwd(), 'WWLI Onboarding Localisation.xlsx');
  const outDir = path.join(process.cwd(), 'tests/fixtures/i18n');
  const result = importXlsx(xlsxPath, outDir);
  console.log(`Imported ${result.totalKeys} keys. Skipped: ${result.skippedRows.length}.`);
}
