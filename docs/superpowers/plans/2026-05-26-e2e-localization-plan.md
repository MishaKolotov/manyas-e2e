# E2E Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Playwright-based e2e test project that validates Walking Survey funnel localization across 10 languages × 3 devices × 2 browser engines (60 projects).

**Architecture:** TypeScript + Playwright Test. Programmatic project matrix generation. xlsx → JSON importer for translations as source of truth. POM with i18n-aware locators. Two-tier visual validation: DOM assertions everywhere + ~54 pixel snapshots on critical screens only.

**Tech Stack:** Node.js 20 LTS, TypeScript (strict), Playwright Test, xlsx (SheetJS), dotenv, tsx, ESLint, Prettier.

**Spec:** `docs/superpowers/specs/2026-05-26-e2e-localization-design.md`

---

## Conventions used in this plan

- All paths are relative to repo root: `/Users/gigamike666/Web Projects/Manyas e2e/`.
- TDD: every behavior gets a failing test first, then implementation.
- Frequent commits: each task ends with one commit. Tasks are independent.
- "Run: `<cmd>`" steps show expected outcome. If output diverges, stop and investigate root cause — never paper over with `--no-verify`, retries, etc.
- Branch: work directly on `main` (no PR flow until CI is added later).

---

## Task 1: Initialize git + project scaffold

**Files:**

- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.nvmrc`
- Create: `README.md` (minimal)

- [ ] **Step 1: Initialize git**

Run:

```bash
cd "/Users/gigamike666/Web Projects/Manyas e2e"
git init -b main
```

Expected: `Initialized empty Git repository ...`

- [ ] **Step 2: Create .gitignore**

Create `.gitignore`:

```
node_modules/
.env
.env.*.local
test-results/
playwright-report/
*-snapshots-actual/
.DS_Store
*.log
.idea/
.vscode/settings.json
```

- [ ] **Step 3: Create .nvmrc**

Create `.nvmrc`:

```
20
```

- [ ] **Step 4: Create package.json**

Create `package.json`:

```json
{
  "name": "manyas-e2e",
  "version": "0.1.0",
  "private": true,
  "description": "E2E localization tests for slimkit.health walking survey",
  "type": "module",
  "scripts": {
    "pretest": "npm run i18n:check",
    "test": "playwright test",
    "test:smoke": "playwright test --project=/en__.*/",
    "test:headed": "playwright test --headed",
    "test:debug": "PWDEBUG=1 playwright test",
    "test:ui": "playwright test --ui",
    "test:update-snapshots": "playwright test --update-snapshots",
    "test:report": "playwright show-report",
    "test:clean": "rimraf test-results playwright-report",
    "i18n:import": "tsx src/utils/excel-to-json.ts",
    "i18n:check": "tsx src/utils/i18n-check.ts",
    "lint": "eslint . --ext .ts",
    "format": "prettier --write \"**/*.{ts,json,md}\"",
    "typecheck": "tsc --noEmit",
    "install:browsers": "playwright install --with-deps chromium webkit"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 5: Create tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "playwright.config.ts"],
  "exclude": ["node_modules", "test-results", "playwright-report"]
}
```

- [ ] **Step 6: Create minimal README.md**

Create `README.md`:

````markdown
# Manyas E2E — Walking Survey Localization Tests

End-to-end localization tests for the Walking Survey funnel at https://dev.slimkit.health/walking/survey/?stripeV64=true.

Status: under construction. See `docs/superpowers/specs/2026-05-26-e2e-localization-design.md` for design.

## Setup

```bash
nvm use
npm install
npm run install:browsers
cp .env.example .env
# fill in BASIC_AUTH_USER / BASIC_AUTH_PASS in .env
npm run i18n:import
npm test
```
````

````

- [ ] **Step 7: Install runtime deps and dev deps**

Run:
```bash
npm install --save-dev \
  @playwright/test@latest \
  typescript@latest \
  tsx@latest \
  dotenv@latest \
  xlsx@latest \
  rimraf@latest \
  eslint@latest \
  @typescript-eslint/parser@latest \
  @typescript-eslint/eslint-plugin@latest \
  prettier@latest
````

Expected: dependencies installed, no errors. `package-lock.json` created.

- [ ] **Step 8: Verify typecheck works**

Run: `npm run typecheck`
Expected: passes with no source files (or with "no inputs were found" — that's fine for now).

- [ ] **Step 9: Commit**

```bash
git add .gitignore .nvmrc package.json package-lock.json tsconfig.json README.md
git commit -m "chore: initial project scaffold (TypeScript, Playwright, deps)"
```

---

## Task 2: Add .env.example and dotenv loader

**Files:**

- Create: `.env.example`
- Create: `src/config/env.ts`
- Create: `tests/config/env.test.ts`

- [ ] **Step 1: Write failing test for env loader**

Create `tests/config/env.test.ts`:

```ts
import { test, expect } from '@playwright/test';
import { loadEnv } from '../../src/config/env';

test('loadEnv throws when BASIC_AUTH_USER missing', () => {
  const orig = process.env.BASIC_AUTH_USER;
  delete process.env.BASIC_AUTH_USER;
  try {
    expect(() => loadEnv()).toThrow(/BASIC_AUTH_USER/);
  } finally {
    if (orig !== undefined) process.env.BASIC_AUTH_USER = orig;
  }
});

test('loadEnv returns parsed config when all vars present', () => {
  process.env.BASIC_AUTH_USER = 'user';
  process.env.BASIC_AUTH_PASS = 'pass';
  process.env.BASE_URL = 'https://example.test';
  process.env.SURVEY_PATH = '/survey/';
  process.env.FEATURE_FLAGS = 'stripeV64=true';
  const cfg = loadEnv();
  expect(cfg.basicAuthUser).toBe('user');
  expect(cfg.baseUrl).toBe('https://example.test');
  expect(cfg.featureFlags).toBe('stripeV64=true');
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx playwright test tests/config/env.test.ts`
Expected: FAIL — `Cannot find module '../../src/config/env'`.

- [ ] **Step 3: Implement env loader**

Create `src/config/env.ts`:

```ts
import 'dotenv/config';

export interface AppEnv {
  basicAuthUser: string;
  basicAuthPass: string;
  baseUrl: string;
  surveyPath: string;
  featureFlags: string;
}

const REQUIRED_VARS = [
  'BASIC_AUTH_USER',
  'BASIC_AUTH_PASS',
  'BASE_URL',
  'SURVEY_PATH',
  'FEATURE_FLAGS',
] as const;

export function loadEnv(): AppEnv {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}.\n` +
        `Copy .env.example to .env and fill in credentials.`,
    );
  }
  return {
    basicAuthUser: process.env.BASIC_AUTH_USER!,
    basicAuthPass: process.env.BASIC_AUTH_PASS!,
    baseUrl: process.env.BASE_URL!,
    surveyPath: process.env.SURVEY_PATH!,
    featureFlags: process.env.FEATURE_FLAGS!,
  };
}
```

- [ ] **Step 4: Create .env.example**

Create `.env.example`:

```
BASIC_AUTH_USER=
BASIC_AUTH_PASS=
BASE_URL=https://dev.slimkit.health
SURVEY_PATH=/walking/survey/
FEATURE_FLAGS=stripeV64=true
```

- [ ] **Step 5: Create local .env for development**

Run:

```bash
cp .env.example .env
```

Then edit `.env` with real credentials:

```
BASIC_AUTH_USER=dev
BASIC_AUTH_PASS=gPgFCeJ7
BASE_URL=https://dev.slimkit.health
SURVEY_PATH=/walking/survey/
FEATURE_FLAGS=stripeV64=true
```

Note: `.env` is in `.gitignore` — do not commit.

- [ ] **Step 6: Create minimal playwright.config.ts to enable tests**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: '50%',
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
```

- [ ] **Step 7: Run test, verify it passes**

Run: `npx playwright test tests/config/env.test.ts`
Expected: 2 tests pass.

- [ ] **Step 8: Commit**

```bash
git add .env.example src/config/env.ts tests/config/env.test.ts playwright.config.ts
git commit -m "feat(config): typed env loader with required-vars validation"
```

---

## Task 3: Define supported locales

**Files:**

- Create: `src/config/locales.ts`
- Create: `tests/config/locales.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/config/locales.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx playwright test tests/config/locales.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement locales config**

Create `src/config/locales.ts`:

```ts
export type LocaleCode = 'en' | 'fr' | 'it' | 'es' | 'ja' | 'ru' | 'de' | 'pt' | 'zh' | 'ko';

export interface LocaleDescriptor {
  code: LocaleCode;
  bcp47: string;
  timezone: string;
  notes?: string;
}

export const SUPPORTED_LOCALES: readonly LocaleDescriptor[] = [
  { code: 'en', bcp47: 'en-US', timezone: 'America/New_York' },
  { code: 'fr', bcp47: 'fr-FR', timezone: 'Europe/Paris' },
  { code: 'it', bcp47: 'it-IT', timezone: 'Europe/Rome' },
  { code: 'es', bcp47: 'es-ES', timezone: 'Europe/Madrid' },
  { code: 'ja', bcp47: 'ja-JP', timezone: 'Asia/Tokyo' },
  { code: 'ru', bcp47: 'ru-RU', timezone: 'Europe/Moscow' },
  { code: 'de', bcp47: 'de-DE', timezone: 'Europe/Berlin' },
  {
    code: 'pt',
    bcp47: 'pt-PT',
    timezone: 'Europe/Lisbon',
    notes: 'TBD — verify against live app (pt-PT vs pt-BR); see Task 14',
  },
  { code: 'zh', bcp47: 'zh-CN', timezone: 'Asia/Shanghai' },
  { code: 'ko', bcp47: 'ko-KR', timezone: 'Asia/Seoul' },
] as const;

export function getLocale(code: LocaleCode): LocaleDescriptor {
  const found = SUPPORTED_LOCALES.find((l) => l.code === code);
  if (!found) throw new Error(`Unknown locale: ${code}`);
  return found;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx playwright test tests/config/locales.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/locales.ts tests/config/locales.test.ts
git commit -m "feat(config): SUPPORTED_LOCALES with BCP-47 + timezone (pt variant TBD)"
```

---

## Task 4: Define device descriptors

**Files:**

- Create: `src/config/devices.ts`
- Create: `tests/config/devices.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/config/devices.test.ts`:

```ts
import { test, expect } from '@playwright/test';
import { DEVICES, getDevice } from '../../src/config/devices';

test('DEVICES contains iphone17, iphone16promax, s20e', () => {
  const codes = DEVICES.map((d) => d.code).sort();
  expect(codes).toEqual(['iphone16promax', 'iphone17', 's20e']);
});

test('every device has viewport, DSR, UA, hasTouch=true, isMobile=true', () => {
  for (const d of DEVICES) {
    expect(d.viewport.width).toBeGreaterThan(300);
    expect(d.viewport.height).toBeGreaterThan(700);
    expect(d.deviceScaleFactor).toBeGreaterThanOrEqual(2);
    expect(d.userAgent).toMatch(/Mozilla\/5\.0/);
    expect(d.hasTouch).toBe(true);
    expect(d.isMobile).toBe(true);
  }
});

test('iphone17 viewport is 402x874', () => {
  const d = getDevice('iphone17');
  expect(d.viewport).toEqual({ width: 402, height: 874 });
});

test('getDevice("nope") throws', () => {
  expect(() => getDevice('nope' as any)).toThrow(/Unknown device/);
});
```

- [ ] **Step 2: Run test, verify fail**

Run: `npx playwright test tests/config/devices.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement devices config**

Create `src/config/devices.ts`:

```ts
export type DeviceCode = 'iphone17' | 'iphone16promax' | 's20e';

export interface DeviceDescriptor {
  code: DeviceCode;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  userAgent: string;
  hasTouch: true;
  isMobile: true;
}

const IPHONE_UA_19 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_UA_18 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/605.1.15';
const SAMSUNG_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G781B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export const DEVICES: readonly DeviceDescriptor[] = [
  {
    code: 'iphone17',
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 3,
    userAgent: IPHONE_UA_19,
    hasTouch: true,
    isMobile: true,
  },
  {
    code: 'iphone16promax',
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    userAgent: IPHONE_UA_18,
    hasTouch: true,
    isMobile: true,
  },
  {
    code: 's20e',
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    userAgent: SAMSUNG_UA,
    hasTouch: true,
    isMobile: true,
  },
] as const;

export function getDevice(code: DeviceCode): DeviceDescriptor {
  const found = DEVICES.find((d) => d.code === code);
  if (!found) throw new Error(`Unknown device: ${code}`);
  return found;
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `npx playwright test tests/config/devices.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/devices.ts tests/config/devices.test.ts
git commit -m "feat(config): custom device descriptors for iPhone17/16ProMax/S20e"
```

---

## Task 5: Excel-to-JSON importer (schema validation only)

**Files:**

- Create: `src/utils/excel-to-json.ts`
- Create: `tests/utils/__importer-test-input.xlsx` (binary fixture, see step 2)
- Create: `tests/utils/excel-to-json.test.ts`

This task implements the schema validation gate from spec §5.2 step 3. We split the importer into smaller tasks to keep each step focused; later tasks add row-filtering and Sheet2 handling.

- [ ] **Step 1: Create fixture xlsx**

We need a small xlsx file with known content to TDD the importer against. Create it via a helper script.

Create `tests/utils/build-test-fixture.ts`:

```ts
import * as xlsx from 'xlsx';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const wb = xlsx.utils.book_new();

const sheet1Data = [
  ['key', 'en', 'ru', 'fr', 'de', 'it', 'pt', 'es', 'zh', 'ja', 'ko'],
  [
    'intro_text_0',
    'Walking',
    'Ходьба',
    'Marche',
    'Gehen',
    'Camminando',
    'Caminhando',
    'Caminando',
    '步行',
    'ウォーキング',
    '걷는',
  ],
  [
    'intro_text_1',
    'Lose weight',
    'Похудеть',
    'Perdre du poids',
    'Abnehmen',
    'Perdere peso',
    'Perder peso',
    'Bajar de peso',
    '减肥',
    '減量',
    '체중감량',
  ],
  ['ВАЖНАЯ ИНФОРМАЦИЯ !!!!', '', '', '', '', '', '', '', '', '', ''],
  ['', 'orphan en value', '', '', '', '', '', '', '', '', ''],
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(sheet1Data), 'Sheet1');

const sheet2Data = [
  [
    'English',
    'Russian',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Spanish',
    'Chinese',
    'Japanese',
    'Korean',
  ],
  [
    'What do you want?',
    'Чего вы хотите?',
    'Que voulez-vous?',
    'Was möchten Sie?',
    'Cosa vuoi?',
    'O que você quer?',
    '¿Qué quieres?',
    '您想要什么？',
    '何が欲しいですか？',
    '무엇을 원하세요?',
  ],
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(sheet2Data), 'Sheet2');

const sheet3Data = [
  ['key', 'en', 'ru', 'fr', 'de', 'it', 'pt', 'es', 'zh', 'ja', 'ko'],
  [
    'paywall_title',
    'Get started',
    'Начать',
    'Commencer',
    'Loslegen',
    'Inizia',
    'Começar',
    'Empezar',
    '开始',
    '始める',
    '시작',
  ],
];
xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(sheet3Data), 'Sheet3');

const out = path.join(__dirname, '__importer-test-input.xlsx');
xlsx.writeFile(wb, out);
console.log('Wrote', out);
```

Run:

```bash
npx tsx tests/utils/build-test-fixture.ts
```

Expected: prints `Wrote .../tests/utils/__importer-test-input.xlsx`.

- [ ] **Step 2: Write failing schema-validation test**

Create `tests/utils/excel-to-json.test.ts`:

```ts
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
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([['key', 'en', 'ru']]), 'Sheet1');
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([[]]), 'Sheet2');
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([[]]), 'Sheet3');
  const tmpFile = path.join(os.tmpdir(), `bad-${Date.now()}.xlsx`);
  xlsx.writeFile(wb, tmpFile);
  try {
    expect(() => importXlsx(tmpFile, os.tmpdir())).toThrow(/missing required column/i);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
```

- [ ] **Step 3: Run, verify fail**

Run: `npx playwright test tests/utils/excel-to-json.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement schema validation skeleton**

Create `src/utils/excel-to-json.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';

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

function validateSheetSchema(
  sheet: xlsx.WorkSheet,
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
      throw new Error(`Workbook missing sheet: ${required}`);
    }
  }
  validateSheetSchema(wb.Sheets['Sheet1'], 'Sheet1', true);
  validateSheetSchema(wb.Sheets['Sheet3'], 'Sheet3', true);

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
```

- [ ] **Step 5: Run, verify schema tests pass**

Run: `npx playwright test tests/utils/excel-to-json.test.ts`
Expected: 2 pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/excel-to-json.ts tests/utils/excel-to-json.test.ts tests/utils/build-test-fixture.ts tests/utils/__importer-test-input.xlsx
git commit -m "feat(import): xlsx schema validation (missing file/sheet/column)"
```

---

## Task 6: Importer — row filtering (Sheet1/Sheet3 keyed sheets)

**Files:**

- Modify: `src/utils/excel-to-json.ts`
- Modify: `tests/utils/excel-to-json.test.ts`

- [ ] **Step 1: Write failing tests for row classification**

Append to `tests/utils/excel-to-json.test.ts`:

```ts
import { classifyRow } from '../../src/utils/excel-to-json';

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
  expect(classifyRow('intro_text_0', { en: 'Walking', ru: 'Ходьба' })).toBe('ACCEPT');
});

test('classifyRow: camelCase key → ACCEPT', () => {
  expect(classifyRow('fitnesLevel_title', { en: "What's your level?" })).toBe('ACCEPT');
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx playwright test tests/utils/excel-to-json.test.ts`
Expected: 7 new tests FAIL — `classifyRow` not exported.

- [ ] **Step 3: Implement classifyRow**

In `src/utils/excel-to-json.ts`, add this export above `importXlsx`:

```ts
export type RowCategory = 'EMPTY' | 'MARKER' | 'EMOJI' | 'RU_NOTE' | 'ACCEPT';

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const CYRILLIC_RE = /[Ѐ-ӿ]/;
const MARKER_RE = /[!?]{2,}/;

export function classifyRow(
  key: string,
  values: Partial<Record<(typeof REQUIRED_LOCALE_COLS)[number], string>>,
): RowCategory {
  const k = String(key).trim();
  if (!k || !values.en || !String(values.en).trim()) return 'EMPTY';
  if (MARKER_RE.test(k)) return 'MARKER';
  if (EMOJI_RE.test(k)) return 'EMOJI';
  if (CYRILLIC_RE.test(k)) {
    const nonRuFilled = REQUIRED_LOCALE_COLS.filter(
      (c) => c !== 'ru' && values[c] && String(values[c]).trim() !== '',
    );
    if (nonRuFilled.length === 0) return 'RU_NOTE';
  }
  return 'ACCEPT';
}
```

- [ ] **Step 4: Run, verify all 7 pass**

Run: `npx playwright test tests/utils/excel-to-json.test.ts -g classifyRow`
Expected: 7 pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/excel-to-json.ts tests/utils/excel-to-json.test.ts
git commit -m "feat(import): row classification rules (EMPTY/MARKER/EMOJI/RU_NOTE/ACCEPT)"
```

---

## Task 7: Importer — value normalization + Sheet2 slugify

**Files:**

- Modify: `src/utils/excel-to-json.ts`
- Modify: `tests/utils/excel-to-json.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/utils/excel-to-json.test.ts`:

```ts
import { normalizeValue, slugifyEnglish } from '../../src/utils/excel-to-json';

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
```

- [ ] **Step 2: Run, verify fail**

Run: `npx playwright test tests/utils/excel-to-json.test.ts -g "normalizeValue|slugifyEnglish"`
Expected: 6 FAIL.

- [ ] **Step 3: Implement helpers**

In `src/utils/excel-to-json.ts`, add:

```ts
export function normalizeValue(raw: string): string {
  return String(raw).replace(/ /g, ' ').replace(/⏎/g, '\n').trim();
}

export function slugifyEnglish(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx playwright test tests/utils/excel-to-json.test.ts -g "normalizeValue|slugifyEnglish"`
Expected: 6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/excel-to-json.ts tests/utils/excel-to-json.test.ts
git commit -m "feat(import): normalizeValue + slugifyEnglish for Sheet2 keys"
```

---

## Task 8: Importer — full end-to-end against fixture xlsx

**Files:**

- Modify: `src/utils/excel-to-json.ts`
- Modify: `tests/utils/excel-to-json.test.ts`

- [ ] **Step 1: Write failing e2e test**

Append to `tests/utils/excel-to-json.test.ts`:

```ts
import * as fs from 'fs';
import * as os from 'os';

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

test('importXlsx fails loud on duplicate keys', () => {
  const wb = xlsx.utils.book_new();
  const header = ['key', 'en', 'fr', 'it', 'es', 'ja', 'ru', 'de', 'pt', 'zh', 'ko'];
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([
      header,
      ['dup_key', 'A', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'],
    ]),
    'Sheet1',
  );
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([
      [
        'English',
        'Russian',
        'French',
        'German',
        'Italian',
        'Portuguese',
        'Spanish',
        'Chinese',
        'Japanese',
        'Korean',
      ],
    ]),
    'Sheet2',
  );
  xlsx.utils.book_append_sheet(
    wb,
    xlsx.utils.aoa_to_sheet([
      header,
      ['dup_key', 'B', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b'],
    ]),
    'Sheet3',
  );
  const tmp = path.join(os.tmpdir(), `dup-${Date.now()}.xlsx`);
  xlsx.writeFile(wb, tmp);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-dup-'));
  try {
    expect(() => importXlsx(tmp, outDir)).toThrow(/duplicate key.*dup_key/i);
  } finally {
    fs.unlinkSync(tmp);
  }
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx playwright test tests/utils/excel-to-json.test.ts -g "importXlsx against fixture|fails loud"`
Expected: FAIL — importXlsx still stub.

- [ ] **Step 3: Implement full importer**

Replace the stub `importXlsx` body (and add helper) in `src/utils/excel-to-json.ts`:

```ts
function readKeyedSheet(
  sheet: xlsx.WorkSheet,
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
  return out;
}

function readSheet2(
  sheet: xlsx.WorkSheet,
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
      throw new Error(`Workbook missing sheet: ${required}`);
    }
  }
  validateSheetSchema(wb.Sheets['Sheet1'], 'Sheet1', true);
  validateSheetSchema(wb.Sheets['Sheet3'], 'Sheet3', true);

  const sheet1Rows = readKeyedSheet(wb.Sheets['Sheet1'], 'Sheet1');
  const sheet3Rows = readKeyedSheet(wb.Sheets['Sheet3'], 'Sheet3');
  const sheet2Rows = readSheet2(wb.Sheets['Sheet2']);

  const skippedRows: ImportResult['skippedRows'] = [];
  const accepted: Record<string, Record<string, string>> = {}; // key → locale → value
  const seenIn: Record<string, string> = {}; // key → sheet

  for (const [sheetName, rows] of [
    ['Sheet1', sheet1Rows] as const,
    ['Sheet3', sheet3Rows] as const,
    ['Sheet2', sheet2Rows] as const,
  ]) {
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
      if (accepted[r.key] && seenIn[r.key] !== sheetName) {
        throw new Error(
          `Duplicate key '${r.key}' found in ${seenIn[r.key]} and ${sheetName}. ` +
            `${seenIn[r.key]} value: '${accepted[r.key].en}'. ${sheetName} value: '${r.values.en}'. ` +
            `Resolve by removing one in xlsx.`,
        );
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
    duplicateKeys: [] as string[], // we throw on duplicates; this stays empty in success path
  };
  fs.writeFileSync(path.join(outDir, '_meta.json'), JSON.stringify(meta, null, 2) + '\n');

  return { totalKeys: meta.totalKeys, perLocale, skippedRows, duplicateKeys: [] };
}

// CLI entrypoint (when run directly via tsx)
if (import.meta.url === `file://${process.argv[1]}`) {
  const xlsxPath = path.join(process.cwd(), 'WWLI Onboarding Localisation.xlsx');
  const outDir = path.join(process.cwd(), 'tests/fixtures/i18n');
  const result = importXlsx(xlsxPath, outDir);
  console.log(`Imported ${result.totalKeys} keys. Skipped: ${result.skippedRows.length}.`);
}
```

- [ ] **Step 4: Run all importer tests**

Run: `npx playwright test tests/utils/excel-to-json.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Run importer against real xlsx**

Run: `npm run i18n:import`
Expected:

- Files appear in `tests/fixtures/i18n/`: `en.json`, `fr.json`, ..., `ko.json`, `_meta.json` (11 files).
- Console: `Imported N keys. Skipped: M.` (N should be around 1300–1500 based on xlsx size).

Manually open `tests/fixtures/i18n/en.json` — confirm it has keys like `intro_text_0: "Walking"`.
Manually open `tests/fixtures/i18n/_meta.json` — confirm `skippedRows` lists the section-header rows we expected to skip.

- [ ] **Step 6: Commit**

```bash
git add src/utils/excel-to-json.ts tests/utils/excel-to-json.test.ts tests/fixtures/i18n/
git commit -m "feat(import): full xlsx → per-locale JSON with skipped-rows audit log"
```

---

## Task 9: i18n:check guard script

**Files:**

- Create: `src/utils/i18n-check.ts`
- Create: `tests/utils/i18n-check.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/utils/i18n-check.test.ts`:

```ts
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runI18nCheck } from '../../src/utils/i18n-check';

function tempScenario(): { xlsx: string; meta: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-check-'));
  const xlsx = path.join(dir, 'src.xlsx');
  const meta = path.join(dir, '_meta.json');
  return { xlsx, meta, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('i18n:check passes when meta newer than xlsx', () => {
  const s = tempScenario();
  try {
    fs.writeFileSync(s.xlsx, 'x');
    // sleep to ensure different mtimes
    const t = Date.now();
    while (Date.now() - t < 50) {}
    fs.writeFileSync(s.meta, '{}');
    expect(() => runI18nCheck(s.xlsx, s.meta)).not.toThrow();
  } finally {
    s.cleanup();
  }
});

test('i18n:check fails when xlsx newer than meta', () => {
  const s = tempScenario();
  try {
    fs.writeFileSync(s.meta, '{}');
    const t = Date.now();
    while (Date.now() - t < 50) {}
    fs.writeFileSync(s.xlsx, 'x');
    expect(() => runI18nCheck(s.xlsx, s.meta)).toThrow(/i18n:import/);
  } finally {
    s.cleanup();
  }
});

test('i18n:check fails when meta missing', () => {
  const s = tempScenario();
  try {
    fs.writeFileSync(s.xlsx, 'x');
    expect(() => runI18nCheck(s.xlsx, s.meta)).toThrow(/i18n:import/);
  } finally {
    s.cleanup();
  }
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx playwright test tests/utils/i18n-check.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement i18n-check**

Create `src/utils/i18n-check.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';

export function runI18nCheck(xlsxPath: string, metaPath: string): void {
  if (!fs.existsSync(xlsxPath)) {
    throw new Error(
      `Source xlsx not found at ${xlsxPath}. Place WWLI Onboarding Localisation.xlsx in repo root.`,
    );
  }
  if (!fs.existsSync(metaPath)) {
    throw new Error(
      `Translation fixtures missing (${metaPath}). Run \`npm run i18n:import\` to regenerate fixtures.`,
    );
  }
  const xlsxMtime = fs.statSync(xlsxPath).mtimeMs;
  const metaMtime = fs.statSync(metaPath).mtimeMs;
  if (xlsxMtime > metaMtime) {
    throw new Error(
      `Source xlsx is newer than translation fixtures. Run \`npm run i18n:import\` to regenerate fixtures.`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const xlsxPath = path.join(process.cwd(), 'WWLI Onboarding Localisation.xlsx');
  const metaPath = path.join(process.cwd(), 'tests/fixtures/i18n/_meta.json');
  try {
    runI18nCheck(xlsxPath, metaPath);
    console.log('i18n fixtures up-to-date.');
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx playwright test tests/utils/i18n-check.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Run manual smoke**

Run: `npm run i18n:check`
Expected: `i18n fixtures up-to-date.`

- [ ] **Step 6: Commit**

```bash
git add src/utils/i18n-check.ts tests/utils/i18n-check.test.ts
git commit -m "feat(import): i18n:check guard (fails if xlsx newer than fixtures)"
```

---

## Task 10: i18n loader (read JSON fixtures at test time)

**Files:**

- Create: `src/utils/i18n-loader.ts`
- Create: `tests/utils/i18n-loader.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/utils/i18n-loader.test.ts`:

```ts
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
```

- [ ] **Step 2: Run, verify fail**

Run: `npx playwright test tests/utils/i18n-loader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement loader**

Create `src/utils/i18n-loader.ts`:

```ts
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
```

- [ ] **Step 4: Run, verify pass**

Run: `npx playwright test tests/utils/i18n-loader.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/i18n-loader.ts tests/utils/i18n-loader.test.ts
git commit -m "feat(i18n): loader with lazy cache and missing-key errors"
```

---

## Task 11: Projects matrix generation

**Files:**

- Create: `src/config/projects.ts`
- Create: `tests/config/projects.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/config/projects.test.ts`:

```ts
import { test, expect } from '@playwright/test';
import { buildProjects } from '../../src/config/projects';

test('buildProjects returns 60 projects (10 × 3 × 2)', () => {
  const projects = buildProjects({
    basicAuthUser: 'u',
    basicAuthPass: 'p',
    baseUrl: 'https://x.test',
    surveyPath: '/s/',
    featureFlags: 'a=1',
  });
  expect(projects).toHaveLength(60);
});

test('project name format is locale__device__engine', () => {
  const projects = buildProjects({
    basicAuthUser: 'u',
    basicAuthPass: 'p',
    baseUrl: 'https://x.test',
    surveyPath: '/s/',
    featureFlags: 'a=1',
  });
  expect(projects).toContainEqual(expect.objectContaining({ name: 'ru__iphone17__webkit' }));
});

test('each project carries metadata with locale, device, engine', () => {
  const projects = buildProjects({
    basicAuthUser: 'u',
    basicAuthPass: 'p',
    baseUrl: 'https://x.test',
    surveyPath: '/s/',
    featureFlags: 'a=1',
  });
  const p = projects.find((x) => x.name === 'ja__s20e__chromium')!;
  expect(p.metadata).toEqual({ locale: 'ja', device: 's20e', engine: 'chromium' });
  expect(p.use!.locale).toBe('ja-JP');
  expect(p.use!.browserName).toBe('chromium');
  expect(p.use!.httpCredentials).toEqual({ username: 'u', password: 'p' });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx playwright test tests/config/projects.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement projects builder**

Create `src/config/projects.ts`:

```ts
import type { Project } from '@playwright/test';
import { SUPPORTED_LOCALES } from './locales';
import { DEVICES } from './devices';
import type { AppEnv } from './env';

const ENGINES = ['chromium', 'webkit'] as const;
type Engine = (typeof ENGINES)[number];

export interface MatrixProject extends Project {
  metadata: { locale: string; device: string; engine: Engine };
}

export function buildProjects(env: AppEnv): MatrixProject[] {
  const list: MatrixProject[] = [];
  for (const loc of SUPPORTED_LOCALES) {
    for (const dev of DEVICES) {
      for (const eng of ENGINES) {
        list.push({
          name: `${loc.code}__${dev.code}__${eng}`,
          use: {
            viewport: dev.viewport,
            deviceScaleFactor: dev.deviceScaleFactor,
            userAgent: dev.userAgent,
            hasTouch: dev.hasTouch,
            isMobile: dev.isMobile,
            browserName: eng,
            locale: loc.bcp47,
            timezoneId: loc.timezone,
            httpCredentials: {
              username: env.basicAuthUser,
              password: env.basicAuthPass,
            },
            baseURL: env.baseUrl,
            trace: 'on-first-retry',
            video: 'retain-on-failure',
            screenshot: 'only-on-failure',
          },
          metadata: { locale: loc.code, device: dev.code, engine: eng },
        });
      }
    }
  }
  return list;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx playwright test tests/config/projects.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/projects.ts tests/config/projects.test.ts
git commit -m "feat(config): matrix project builder (60 = 10 locales × 3 devices × 2 engines)"
```

---

## Task 12: Wire matrix into playwright.config.ts

**Files:**

- Modify: `playwright.config.ts`

- [ ] **Step 1: Replace minimal config with full version**

Replace the entire contents of `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
import { loadEnv } from './src/config/env';
import { buildProjects } from './src/config/projects';

const env = loadEnv();

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 4 : '50%',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  outputDir: 'test-results',
  preserveOutput: 'failures-only',
  use: {
    storageState: undefined,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: buildProjects(env),
});
```

- [ ] **Step 2: Run dry-list to verify 60 projects materialized**

Run: `npx playwright test --list --reporter=list 2>&1 | head -20`
Expected: list shows tests with project names like `[ru__iphone17__webkit]`. Total tests will be `(existing test count) × 60` — verify projects appear by grepping:

```bash
npx playwright test --list 2>&1 | grep -oE '\[[^]]+\]' | sort -u | head -20
```

Expected: 60 unique project labels.

- [ ] **Step 3: Smoke run on one project**

Run: `npx playwright test --project=en__iphone17__chromium tests/config/`
Expected: existing config tests pass under the en**iphone17**chromium project.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts
git commit -m "feat(config): wire 60-project matrix into playwright.config.ts"
```

---

## Task 13: i18n fixture for tests (gives translations matching current project)

**Files:**

- Create: `src/fixtures/i18n.fixture.ts`
- Create: `tests/fixtures/i18n.fixture.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/fixtures/i18n.fixture.test.ts`:

```ts
import { test, expect } from '../../src/fixtures/i18n.fixture';

test('i18n fixture matches project locale (intro_text_0)', async ({ i18n, projectMeta }) => {
  expect(i18n.locale).toBe(projectMeta.locale);
  // smoke: known key from xlsx (English source)
  const v = i18n.get('intro_text_0');
  expect(v).toBeTruthy();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npx playwright test --project=en__iphone17__chromium tests/fixtures/i18n.fixture.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement i18n fixture**

Create `src/fixtures/i18n.fixture.ts`:

```ts
import { test as base } from '@playwright/test';
import type { LocaleCode } from '../config/locales';
import { loadTranslations, type Translations } from '../utils/i18n-loader';

export interface ProjectMeta {
  locale: LocaleCode;
  device: string;
  engine: string;
}

export const test = base.extend<{
  i18n: Translations;
  projectMeta: ProjectMeta;
}>({
  projectMeta: async ({}, use, testInfo) => {
    const md = testInfo.project.metadata as ProjectMeta | undefined;
    if (!md?.locale) {
      throw new Error(
        `Project '${testInfo.project.name}' has no metadata.locale. Did you go through buildProjects()?`,
      );
    }
    await use(md);
  },
  i18n: async ({ projectMeta }, use) => {
    await use(loadTranslations(projectMeta.locale as LocaleCode));
  },
});

export const expect = base.expect;
```

- [ ] **Step 4: Run, verify pass**

Run: `npx playwright test --project=en__iphone17__chromium tests/fixtures/i18n.fixture.test.ts`
Expected: 1 pass.

Then run for ru:

```bash
npx playwright test --project=ru__iphone17__chromium tests/fixtures/i18n.fixture.test.ts
```

Expected: 1 pass. The same test now reads `intro_text_0` = "Ходьба" from `ru.json`.

- [ ] **Step 5: Commit**

```bash
git add src/fixtures/i18n.fixture.ts tests/fixtures/i18n.fixture.test.ts
git commit -m "feat(fixtures): i18n fixture derives translations from project.metadata.locale"
```

---

## Task 14: BasePage with state isolation + URL composition

**Files:**

- Create: `src/utils/wait-stable.ts`
- Create: `src/utils/visual-checks.ts`
- Create: `src/pages/BasePage.ts`

We need three utilities + BasePage in one task because BasePage uses them. Tests for BasePage land in Task 15 (LandingPage) — testing BasePage in isolation is overkill given how thin it is.

- [ ] **Step 1: Create wait-stable.ts**

Create `src/utils/wait-stable.ts`:

```ts
import type { Page } from '@playwright/test';

/**
 * Waits until the page is visually stable: fonts loaded, images decoded,
 * scroll at top. Use before pixel snapshots.
 */
export async function waitForVisualStability(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    await (document as Document).fonts?.ready;
  });
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalHeight !== 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = img.onerror = () => resolve();
            }),
      ),
    );
  });
  await page.evaluate(() => window.scrollTo(0, 0));
}
```

- [ ] **Step 2: Create visual-checks.ts**

Create `src/utils/visual-checks.ts`:

```ts
import { expect, type Locator, type Page } from '@playwright/test';

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal page scroll detected (long string broke layout?)').toBe(false);
}

export async function assertNoTextClipping(locator: Locator): Promise<void> {
  const clipped = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const hides = style.overflow === 'hidden' || style.textOverflow === 'ellipsis';
    if (!hides) return false;
    return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
  });
  expect(clipped, 'text appears clipped inside overflow:hidden').toBe(false);
}

export async function assertButtonInViewport(button: Locator): Promise<void> {
  await expect(button).toBeInViewport();
}
```

- [ ] **Step 3: Create BasePage**

Create `src/pages/BasePage.ts`:

```ts
import type { BrowserContext, Page } from '@playwright/test';
import type { Translations } from '../utils/i18n-loader';
import { loadEnv } from '../config/env';
import { waitForVisualStability } from '../utils/wait-stable';

export class BasePage {
  protected readonly env = loadEnv();

  constructor(
    public readonly page: Page,
    public readonly context: BrowserContext,
    public readonly i18n: Translations,
  ) {}

  /**
   * Install per-page storage cleanup BEFORE any script runs. Idempotent.
   */
  async installCleanState(): Promise<void> {
    await this.context.clearCookies();
    await this.context.addInitScript(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).localStorage?.clear?.();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).sessionStorage?.clear?.();
      } catch {
        // ignore: some pages restrict storage access pre-navigation
      }
    });
  }

  buildSurveyUrl(): string {
    const url = new URL(this.env.surveyPath, this.env.baseUrl);
    const flags = new URLSearchParams(this.env.featureFlags ?? '');
    for (const [k, v] of flags) url.searchParams.set(k, v);
    return url.toString();
  }

  async goto(): Promise<this> {
    await this.installCleanState();
    await this.page.goto(this.buildSurveyUrl());
    await this.ready();
    return this;
  }

  async ready(): Promise<void> {
    await waitForVisualStability(this.page);
  }

  text(key: string): string {
    return this.i18n.get(key);
  }
}
```

- [ ] **Step 4: Sanity-typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils/wait-stable.ts src/utils/visual-checks.ts src/pages/BasePage.ts
git commit -m "feat(pages): BasePage with state isolation, URL composition, visual helpers"
```

---

## Task 15: First spec — landing.spec.ts (red → green discovery loop)

**Files:**

- Create: `src/pages/LandingPage.ts`
- Create: `tests/localization/landing.spec.ts`

This task does TDD against the **live application**. We start with a deliberately-wrong assertion to confirm the test machinery actually fails, then refine to a passing test against real selectors.

- [ ] **Step 1: Explore the live app manually**

Open the app in your browser:

```
https://dev.slimkit.health/walking/survey/?stripeV64=true
```

(Use BASIC auth `dev` / `gPgFCeJ7`.)

In DevTools, identify the landing screen's:

- Main headline element (look for `data-testid`, otherwise pick a stable role/text)
- Primary CTA button (the "Start" / "Continue" / similar)

Write down the i18n keys you expect from `tests/fixtures/i18n/en.json` that match what you see on screen. For example, if the headline text is "Walking for weight loss", search en.json for that string — likely `intro_text_1`.

Capture in your head: which 1–2 keys you'll assert on.

- [ ] **Step 2: Write deliberately failing test (forced-fail to validate machinery)**

Create `tests/localization/landing.spec.ts`:

```ts
import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { assertNoHorizontalOverflow } from '../../src/utils/visual-checks';

test('landing shows translated headline and CTA', async ({ page, context, i18n, projectMeta }) => {
  const landing = await new LandingPage(page, context, i18n).goto();

  // INTENTIONAL FAILURE PROBE — replace with real key after first run.
  // We expect this to FAIL on first run to confirm the framework actually
  // exercises the page.
  await expect(landing.headline).toHaveText('THIS_SHOULD_NEVER_MATCH');

  await assertNoHorizontalOverflow(page);
});
```

- [ ] **Step 3: Create skeleton LandingPage**

Create `src/pages/LandingPage.ts`:

```ts
import { BasePage } from './BasePage';

export class LandingPage extends BasePage {
  // TODO: replace this selector after manual DevTools inspection in step 1.
  // Start with a deliberately-broad locator; refine to data-testid / role+name.
  get headline() {
    return this.page.locator('h1, [data-testid*="headline"], [role="heading"]').first();
  }

  get cta() {
    return this.page.getByRole('button', { name: /start|begin|continue|next/i }).first();
  }
}
```

- [ ] **Step 4: Run, observe the failure mode**

Run: `npx playwright test --project=en__iphone17__chromium tests/localization/landing.spec.ts --headed`
Expected: test FAILS at the `'THIS_SHOULD_NEVER_MATCH'` assert. **Verify** that:

- The browser actually opened the survey page (you saw the real landing).
- The headline locator did find an element (the error message names actual text from the page, not "no elements found").

If the locator finds nothing, fix the locator before going on. If it finds the wrong element, fix the locator before going on.

- [ ] **Step 5: Replace probe with real assertion**

Based on what you saw in step 1 and the actual rendered text from step 4, edit `tests/localization/landing.spec.ts`:

```ts
import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { assertNoHorizontalOverflow } from '../../src/utils/visual-checks';

test('landing shows translated headline and CTA', async ({ page, context, i18n }) => {
  const landing = await new LandingPage(page, context, i18n).goto();

  // Replace 'intro_text_1' with the actual key matching the live headline.
  // i18n.get() throws on missing keys, so a wrong key fails loud.
  await expect(landing.headline).toContainText(i18n.get('intro_text_1'));
  await expect(landing.cta).toBeVisible();

  await assertNoHorizontalOverflow(page);
});
```

(If the live headline maps to a different key, substitute that key.)

- [ ] **Step 6: Run again on en, verify pass**

Run: `npx playwright test --project=en__iphone17__chromium tests/localization/landing.spec.ts`
Expected: PASS.

- [ ] **Step 7: Run on ru, verify still passes (translation works)**

Run: `npx playwright test --project=ru__iphone17__chromium tests/localization/landing.spec.ts`
Expected: PASS. (Locale switched to ru-RU → app should render Russian → assertion uses ru-RU translation.) If it FAILS, two possibilities:

1. The app doesn't actually switch language from browser locale. **STOP** — escalate to user (this would invalidate the whole project premise).
2. Our key choice was wrong. Refine `i18n.get('intro_text_X')` to a key that's reliably in both en.json and ru.json.

- [ ] **Step 8: Run on all en projects + a sampling of locales**

Run: `npx playwright test --project=/en__.*/ tests/localization/landing.spec.ts`
Expected: 6 PASS (all en × device × engine combinations).

Run: `npx playwright test --project=/.*_iphone17__chromium/ tests/localization/landing.spec.ts`
Expected: 10 PASS (all locales × iphone17 × chromium).

- [ ] **Step 9: Commit**

```bash
git add src/pages/LandingPage.ts tests/localization/landing.spec.ts
git commit -m "feat(test): landing.spec verifies translated headline per locale"
```

---

## Task 16: Survey-flow detect-and-answer helper + survey-flow.spec.ts

**Files:**

- Create: `src/pages/SurveyPage.ts`
- Create: `src/pages/PaywallPage.ts`
- Create: `tests/helpers/survey-flow.ts`
- Create: `tests/localization/survey-flow.spec.ts`

This task is exploratory — we don't yet know the exact DOM patterns of survey steps. The helper must handle 4 question types and end when paywall is reached.

- [ ] **Step 1: Manual exploration of survey flow (UNTESTED DISCOVERY STEP)**

Open the app, log in, click through the survey from start to paywall. While doing so, take notes in `docs/superpowers/notes/survey-flow-discovery.md`:

```bash
mkdir -p docs/superpowers/notes
```

Create `docs/superpowers/notes/survey-flow-discovery.md`:

```markdown
# Survey flow discovery notes — 2026-05-26

Recorded by walking through https://dev.slimkit.health/walking/survey/?stripeV64=true manually.

## Question types observed

- [ ] single-choice (radio cards) — DOM pattern: ...
- [ ] multi-choice (checkboxes / cards) — DOM pattern: ...
- [ ] slider (range) — DOM pattern: ...
- [ ] text/number input — DOM pattern: ...

## Step count

- Min path observed (always pick first option): N steps
- Max path observed (deliberate variation): M steps

## Paywall indicator

How we recognize "we've reached the paywall":

- URL contains: ...
- Element appears: ...
- Stripe iframe loads: ...

## MAX_STEPS choice

cap = max_observed × 1.5 = ...
```

Fill in the placeholders as you click through. This document is the source for the next steps. DO NOT proceed until you have it filled in.

- [ ] **Step 2: Commit the notes**

```bash
git add docs/superpowers/notes/survey-flow-discovery.md
git commit -m "docs: survey flow discovery notes (DOM patterns, step count, paywall signal)"
```

- [ ] **Step 3: Implement SurveyPage with question-type detection**

Create `src/pages/SurveyPage.ts` — **adapt selectors below to what you observed in step 1**:

```ts
import { BasePage } from './BasePage';

export type QuestionType = 'single' | 'multi' | 'slider' | 'input' | 'unknown';

export class SurveyPage extends BasePage {
  /**
   * Detects the question type on the current step.
   * IMPORTANT: selectors below are placeholders — replace with what you
   * observed in survey-flow-discovery.md.
   */
  async detectQuestionType(): Promise<QuestionType> {
    // Order matters — most specific first.
    if (
      await this.page
        .locator('input[type="range"]')
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return 'slider';
    }
    if (
      await this.page
        .locator('input[type="number"], input[type="text"]')
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return 'input';
    }
    const checkboxes = this.page.locator('input[type="checkbox"], [role="checkbox"]');
    if ((await checkboxes.count()) > 0) return 'multi';
    const choices = this.page.locator(
      '[role="radio"], [data-testid*="option"], button[data-testid*="answer"]',
    );
    if ((await choices.count()) > 0) return 'single';
    return 'unknown';
  }

  /**
   * Answer the current step. Picks the first valid option for choice/slider,
   * sensible defaults for inputs.
   */
  async answerCurrentStep(): Promise<void> {
    const type = await this.detectQuestionType();
    switch (type) {
      case 'single': {
        const first = this.page
          .locator('[role="radio"], [data-testid*="option"], button[data-testid*="answer"]')
          .first();
        await first.click();
        break;
      }
      case 'multi': {
        const first = this.page.locator('input[type="checkbox"], [role="checkbox"]').first();
        await first.check({ force: true }).catch(async () => first.click());
        break;
      }
      case 'slider': {
        const slider = this.page.locator('input[type="range"]').first();
        await slider.focus();
        await this.page.keyboard.press('ArrowRight');
        await this.page.keyboard.press('ArrowRight');
        break;
      }
      case 'input': {
        const input = this.page.locator('input[type="number"], input[type="text"]').first();
        const type = await input.getAttribute('type');
        await input.fill(type === 'number' ? '30' : 'Test');
        break;
      }
      case 'unknown':
        throw new Error('Unrecognized question type on current step');
    }
  }

  /**
   * Click the "next/continue" button on the current step.
   * Adjust selector to what you observed.
   */
  async next(): Promise<void> {
    const nextBtn = this.page.getByRole('button', { name: /next|continue|→|далее/i }).first();
    await nextBtn.click();
  }

  /**
   * True once paywall is visible — adapt to your observed signal.
   */
  async isPaywallVisible(): Promise<boolean> {
    return await this.page
      .locator('[data-testid*="paywall"], [data-testid*="checkout"], iframe[src*="stripe"]')
      .first()
      .isVisible()
      .catch(() => false);
  }
}
```

- [ ] **Step 4: Implement PaywallPage**

Create `src/pages/PaywallPage.ts`:

```ts
import { BasePage } from './BasePage';

export class PaywallPage extends BasePage {
  get heading() {
    return this.page
      .locator('[data-testid*="paywall"] h1, [data-testid*="checkout"] h1, h1, h2')
      .first();
  }

  get priceBlock() {
    return this.page.locator('[data-testid*="price"], [class*="price"], [data-price]').first();
  }

  get cta() {
    return this.page
      .getByRole('button', { name: /pay|subscribe|start|continue|оплатить|купить/i })
      .first();
  }
}
```

- [ ] **Step 5: Implement survey-flow helper**

Create `tests/helpers/survey-flow.ts`:

```ts
import type { SurveyPage } from '../../src/pages/SurveyPage';

// Adjust after step 1 discovery — see notes for the cap rationale.
export const MAX_STEPS = 60;

export async function completeAllSteps(survey: SurveyPage): Promise<number> {
  let steps = 0;
  while (steps < MAX_STEPS) {
    if (await survey.isPaywallVisible()) return steps;
    await survey.answerCurrentStep();
    await survey.next();
    await survey.ready();
    steps += 1;
  }
  throw new Error(
    `Hit MAX_STEPS=${MAX_STEPS} without reaching paywall. ` +
      `Either the survey grew, the paywall signal changed, or detect-and-answer is stuck on a step.`,
  );
}
```

- [ ] **Step 6: Write survey-flow test**

Create `tests/localization/survey-flow.spec.ts`:

```ts
import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { SurveyPage } from '../../src/pages/SurveyPage';
import { PaywallPage } from '../../src/pages/PaywallPage';
import { completeAllSteps } from '../helpers/survey-flow';
import { assertNoHorizontalOverflow } from '../../src/utils/visual-checks';

test('full survey reaches paywall and renders localized strings throughout', async ({
  page,
  context,
  i18n,
}) => {
  const landing = await new LandingPage(page, context, i18n).goto();
  await landing.cta.click();
  await landing.ready();

  const survey = new SurveyPage(page, context, i18n);
  const steps = await completeAllSteps(survey);
  expect(steps).toBeGreaterThan(0);

  const paywall = new PaywallPage(page, context, i18n);
  await expect(paywall.heading).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
```

- [ ] **Step 7: Run on EN smoke**

Run: `npx playwright test --project=en__iphone17__chromium tests/localization/survey-flow.spec.ts --headed`
Expected: PASS. If it hits MAX_STEPS, refine selectors in SurveyPage based on what you see (selectors in step 3 are placeholders).

- [ ] **Step 8: Run on RU to confirm locale doesn't break flow**

Run: `npx playwright test --project=ru__iphone17__chromium tests/localization/survey-flow.spec.ts`
Expected: PASS. (Selectors that worked in EN should still work in RU because they're based on roles/test-ids, not visible text.)

- [ ] **Step 9: Tune MAX_STEPS**

After the test passes, update `MAX_STEPS` in `tests/helpers/survey-flow.ts` to `ceil(observed_max × 1.5)`. Add a comment explaining the source observation.

- [ ] **Step 10: Commit**

```bash
git add src/pages/SurveyPage.ts src/pages/PaywallPage.ts tests/helpers/survey-flow.ts tests/localization/survey-flow.spec.ts
git commit -m "feat(test): full survey flow with detect-and-answer + paywall reach"
```

---

## Task 17: paywall.spec.ts — locale-formatted price

**Files:**

- Create: `tests/localization/paywall.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/localization/paywall.spec.ts`:

```ts
import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { SurveyPage } from '../../src/pages/SurveyPage';
import { PaywallPage } from '../../src/pages/PaywallPage';
import { completeAllSteps } from '../helpers/survey-flow';
import { assertNoHorizontalOverflow } from '../../src/utils/visual-checks';

test('paywall renders heading, CTA, and price block in current locale', async ({
  page,
  context,
  i18n,
}) => {
  const landing = await new LandingPage(page, context, i18n).goto();
  await landing.cta.click();
  await landing.ready();

  const survey = new SurveyPage(page, context, i18n);
  await completeAllSteps(survey);

  const paywall = new PaywallPage(page, context, i18n);
  await expect(paywall.heading).toBeVisible();
  await expect(paywall.cta).toBeVisible();
  await expect(paywall.priceBlock).toBeVisible();

  // Price must contain digits (we don't hardcode currency symbol because
  // the app may use locale-specific formatting like "$ 9.99" vs "9,99 €")
  await expect(paywall.priceBlock).toHaveText(/\d/);
  await assertNoHorizontalOverflow(page);
});
```

- [ ] **Step 2: Run on en smoke**

Run: `npx playwright test --project=en__iphone17__chromium tests/localization/paywall.spec.ts`
Expected: PASS.

- [ ] **Step 3: Run on de (long strings) + ja (CJK)**

Run: `npx playwright test --project=de__iphone17__chromium tests/localization/paywall.spec.ts`
Run: `npx playwright test --project=ja__iphone17__chromium tests/localization/paywall.spec.ts`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/localization/paywall.spec.ts
git commit -m "feat(test): paywall locale-formatted price + heading + CTA"
```

---

## Task 18: no-missing-keys.spec.ts

**Files:**

- Create: `tests/fixtures/i18n/_visible-ascii-whitelist.json`
- Create: `tests/localization/no-missing-keys.spec.ts`

- [ ] **Step 1: Seed the ASCII whitelist**

Create `tests/fixtures/i18n/_visible-ascii-whitelist.json`:

```json
{
  "exact": ["email", "ok", "next", "info", "stripe", "iphone", "android"],
  "patterns": ["^https?://", "@[a-z]+\\.[a-z]+$"]
}
```

- [ ] **Step 2: Write the test**

Create `tests/localization/no-missing-keys.spec.ts`:

```ts
import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { SurveyPage } from '../../src/pages/SurveyPage';
import { completeAllSteps } from '../helpers/survey-flow';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WHITELIST = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../fixtures/i18n/_visible-ascii-whitelist.json'),
    'utf8',
  ),
) as { exact: string[]; patterns: string[] };

const KEY_LOOKING_RE = /^[a-zA-Z][a-zA-Z0-9_]*[._][a-zA-Z0-9_.]+$/;
const PLACEHOLDER_RE = /\{\{[^}]+\}\}/;
const EXACT = new Set(WHITELIST.exact);
const PATTERNS = WHITELIST.patterns.map((p) => new RegExp(p, 'i'));

function isLeakedKey(text: string): boolean {
  const t = text.trim();
  if (t.length < 4 || t.length > 80) return false;
  if (!KEY_LOOKING_RE.test(t)) return false;
  if (EXACT.has(t)) return false;
  if (PATTERNS.some((p) => p.test(t))) return false;
  return true;
}

async function scrapeViolations(page: import('@playwright/test').Page) {
  const allTextNodes: string[] = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const t = (node.nodeValue ?? '').trim();
      if (t) out.push(t);
    }
    return out;
  });
  const leakedKeys = allTextNodes.filter(isLeakedKey);
  const placeholders = allTextNodes.filter((t) => PLACEHOLDER_RE.test(t));
  return { leakedKeys, placeholders };
}

test('no unresolved i18n keys or placeholders visible on any survey screen', async ({
  page,
  context,
  i18n,
}) => {
  const landing = await new LandingPage(page, context, i18n).goto();
  const onLanding = await scrapeViolations(page);
  expect(onLanding.leakedKeys, 'leaked keys on landing').toEqual([]);
  expect(onLanding.placeholders, 'placeholders on landing').toEqual([]);

  await landing.cta.click();
  await landing.ready();
  const survey = new SurveyPage(page, context, i18n);

  for (let i = 0; i < 5; i++) {
    if (await survey.isPaywallVisible()) break;
    const violations = await scrapeViolations(page);
    expect(violations.leakedKeys, `leaked keys on survey step ${i}`).toEqual([]);
    expect(violations.placeholders, `placeholders on survey step ${i}`).toEqual([]);
    await survey.answerCurrentStep();
    await survey.next();
    await survey.ready();
  }

  // sample paywall too
  await completeAllSteps(survey);
  const onPaywall = await scrapeViolations(page);
  expect(onPaywall.leakedKeys, 'leaked keys on paywall').toEqual([]);
  expect(onPaywall.placeholders, 'placeholders on paywall').toEqual([]);
});
```

- [ ] **Step 3: Run on en + ja + ru**

Run:

```bash
npx playwright test --project=en__iphone17__chromium tests/localization/no-missing-keys.spec.ts
npx playwright test --project=ja__iphone17__chromium tests/localization/no-missing-keys.spec.ts
npx playwright test --project=ru__iphone17__chromium tests/localization/no-missing-keys.spec.ts
```

Expected: PASS in all 3. If any leaked key is reported, investigate:

- Is it a real bug (app shows raw key)? → Leave the test failing, report.
- Is it a legitimate ASCII string in a CJK locale (e.g., a brand name)? → Add to `_visible-ascii-whitelist.json` with a comment.
- Does the regex false-positive on something? → Tighten the regex.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/i18n/_visible-ascii-whitelist.json tests/localization/no-missing-keys.spec.ts
git commit -m "feat(test): no-missing-keys scan with ASCII whitelist + placeholder check"
```

---

## Task 19: visual.spec.ts with reduced snapshot scope

**Files:**

- Create: `tests/localization/visual.spec.ts`

- [ ] **Step 1: Write the test with scope skips**

Create `tests/localization/visual.spec.ts`:

```ts
import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { SurveyPage } from '../../src/pages/SurveyPage';
import { PaywallPage } from '../../src/pages/PaywallPage';
import { completeAllSteps } from '../helpers/survey-flow';
import { waitForVisualStability } from '../../src/utils/wait-stable';

const SNAPSHOT_OPTS = {
  fullPage: true,
  maxDiffPixelRatio: 0.02,
  animations: 'disabled' as const,
  caret: 'hide' as const,
};

test.describe('visual snapshots', () => {
  test('landing snapshot', async ({ page, context, i18n, projectMeta }) => {
    // Landing: full coverage on EN, only iphone17 on non-EN.
    test.skip(
      projectMeta.locale !== 'en' && projectMeta.device !== 'iphone17',
      'non-EN locales only snapshot iPhone 17',
    );
    await new LandingPage(page, context, i18n).goto();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot('landing.png', SNAPSHOT_OPTS);
  });

  test('first survey step snapshot', async ({ page, context, i18n, projectMeta }) => {
    // First survey step: EN only, all devices/engines.
    test.skip(projectMeta.locale !== 'en', 'survey-step snapshot is EN-only');
    const landing = await new LandingPage(page, context, i18n).goto();
    await landing.cta.click();
    await landing.ready();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot('first-survey-step.png', SNAPSHOT_OPTS);
  });

  test('paywall snapshot', async ({ page, context, i18n, projectMeta }) => {
    test.skip(
      projectMeta.locale !== 'en' && projectMeta.device !== 'iphone17',
      'non-EN locales only snapshot iPhone 17 for paywall',
    );
    const landing = await new LandingPage(page, context, i18n).goto();
    await landing.cta.click();
    await landing.ready();
    const survey = new SurveyPage(page, context, i18n);
    await completeAllSteps(survey);
    const paywall = new PaywallPage(page, context, i18n);
    await expect(paywall.heading).toBeVisible();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot('paywall.png', SNAPSHOT_OPTS);
  });
});
```

- [ ] **Step 2: Generate baseline snapshots**

Run: `npx playwright test tests/localization/visual.spec.ts --update-snapshots`
Expected:

- 24 landing snapshots (6 EN + 18 non-EN-iphone17)
- 6 first-survey-step snapshots
- 24 paywall snapshots
- Total ~54 PNGs created under `tests/localization/visual.spec.ts-snapshots/`

- [ ] **Step 3: Re-run without --update to confirm baselines stable**

Run: `npx playwright test tests/localization/visual.spec.ts`
Expected: ~54 PASS, no diffs.

- [ ] **Step 4: Commit**

```bash
git add tests/localization/visual.spec.ts tests/localization/visual.spec.ts-snapshots/
git commit -m "feat(test): pixel snapshots with reduced scope (54 baselines)"
```

---

## Task 20: ESLint + Prettier configuration

**Files:**

- Create: `.eslintrc.cjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`

- [ ] **Step 1: Create ESLint config**

Create `.eslintrc.cjs`:

```cjs
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: [
    'node_modules',
    'test-results',
    'playwright-report',
    '**/*-snapshots*/**',
    'tests/fixtures/i18n/*.json',
  ],
};
```

- [ ] **Step 2: Create Prettier config**

Create `.prettierrc.json`:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "arrowParens": "always"
}
```

Create `.prettierignore`:

```
node_modules
test-results
playwright-report
*-snapshots/
tests/fixtures/i18n/*.json
WWLI Onboarding Localisation.xlsx
```

- [ ] **Step 3: Run lint + format**

Run: `npm run lint`
Expected: passes (or shows trivial issues you fix inline).

Run: `npm run format`
Expected: reformats any inconsistent files.

- [ ] **Step 4: Re-run all tests on en smoke to confirm no regressions**

Run: `npm run test:smoke`
Expected: PASS (all en × 3 devices × 2 engines = 6 projects × ~4 tests/spec = ~24 tests pass).

- [ ] **Step 5: Commit**

```bash
git add .eslintrc.cjs .prettierrc.json .prettierignore
git commit -m "chore: ESLint + Prettier config"
```

---

## Task 21: Verify open spec items (pt variant, UA-smoke, MAX_STEPS calibration)

**Files:**

- Modify: `src/config/locales.ts` (only if pt-BR needed)
- Modify: `tests/helpers/survey-flow.ts` (calibrate MAX_STEPS)
- Modify: `README.md` (document UA-smoke result)

This task closes spec acceptance criteria #7, #8, #9.

- [ ] **Step 1: pt variant resolution**

Run:

```bash
npx playwright test --project=pt__iphone17__chromium tests/localization/landing.spec.ts --headed
```

Observe in the headed browser what text appears on the landing page. Compare with both:

- `tests/fixtures/i18n/pt.json` for the key you assert on
- The text the live app actually rendered

If the test passes AND text matches xlsx → `pt-PT` is correct (xlsx column = European Portuguese).

If the test FAILS because app rendered a different translation (e.g., "Bem-vindo" vs "Olá") → likely pt-BR. Change in `src/config/locales.ts`:

```ts
{ code: 'pt', bcp47: 'pt-BR', timezone: 'America/Sao_Paulo' },
```

Remove the `notes` field. Re-run the test.

Document outcome in `README.md`:

```markdown
## Portuguese variant

Resolved to: `pt-XX` (date 2026-MM-DD). Source of truth: the live app responded with [observed text] when sent `Accept-Language: pt-XX`.
```

- [ ] **Step 2: MAX_STEPS calibration**

Run several iterations of survey-flow.spec.ts on en with `--headed` to observe step counts:

```bash
for i in 1 2 3; do
  npx playwright test --project=en__iphone17__chromium tests/localization/survey-flow.spec.ts --reporter=line
done
```

Add console logging to `tests/helpers/survey-flow.ts` temporarily inside `completeAllSteps`:

```ts
console.log(`[survey-flow] reached paywall in ${steps} steps`);
```

Observe min and max step counts. Set `MAX_STEPS` in the same file to `Math.ceil(maxObserved * 1.5)`. Remove the temporary log. Add a brief comment:

```ts
// MAX_STEPS = 30 based on observed max 18 steps × 1.5 safety margin (measured 2026-05-26)
export const MAX_STEPS = 30;
```

- [ ] **Step 3: UA-smoke check**

Run:

```bash
# Capture HTML using our UA-stub
curl -u dev:gPgFCeJ7 \
  -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/605.1.15" \
  "https://dev.slimkit.health/walking/survey/?stripeV64=true" > /tmp/with-stub-ua.html

# Capture HTML with a known-real UA (Chrome DevTools iPhone 14 preset)
curl -u dev:gPgFCeJ7 \
  -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" \
  "https://dev.slimkit.health/walking/survey/?stripeV64=true" > /tmp/with-real-ua.html

# Diff (ignore comment hashes / build IDs if present)
diff <(grep -v '<!--' /tmp/with-stub-ua.html) <(grep -v '<!--' /tmp/with-real-ua.html) | head -30
```

If diff is empty (or only trivial differences like CSRF tokens) → server does not branch by UA → document this in README:

```markdown
## UA-smoke result

Verified 2026-MM-DD: server response is identical for our iPhone-17 UA stub and a real iPhone-14 UA. Backend does not branch on user-agent for the survey funnel.
```

If diff is non-trivial (different HTML structure, different content) → file an issue and add a note to spec §11 that the UA risk has materialized; downgrade scope or move to real-device cloud for affected checks.

- [ ] **Step 4: Run smoke suite to confirm everything still green**

Run: `npm run test:smoke`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/locales.ts tests/helpers/survey-flow.ts README.md
git commit -m "chore: resolve open spec items (pt variant, UA-smoke, MAX_STEPS)"
```

---

## Task 22: README polish + final acceptance run

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Expand README**

Replace `README.md` with the full version:

````markdown
# Manyas E2E — Walking Survey Localization Tests

End-to-end localization tests for https://dev.slimkit.health/walking/survey/?stripeV64=true across 10 languages × 3 devices × 2 browser engines.

## Quick start

```bash
nvm use                       # Node 20
npm install
npm run install:browsers      # Chromium + WebKit
cp .env.example .env
# Edit .env: set BASIC_AUTH_USER and BASIC_AUTH_PASS
npm run i18n:import           # Convert xlsx to JSON fixtures
npm test                      # Full matrix (~45 min)
```
````

## Common tasks

| What                                         | Command                                                 |
| -------------------------------------------- | ------------------------------------------------------- |
| Smoke run (EN only, fast)                    | `npm run test:smoke`                                    |
| Single combination                           | `npx playwright test --project=ru__iphone17__webkit`    |
| All RU variants                              | `npx playwright test --project=/ru__.*/`                |
| Open HTML report after a run                 | `npm run test:report`                                   |
| Update snapshots after intentional UI change | `npm run test:update-snapshots`                         |
| Re-import translations after xlsx changes    | `npm run i18n:import`                                   |
| Verify xlsx and JSON are in sync             | `npm run i18n:check`                                    |
| Clean reports/results                        | `npm run test:clean`                                    |
| Lint / typecheck / format                    | `npm run lint` / `npm run typecheck` / `npm run format` |

## Project matrix

60 Playwright projects: every combination of `{en,fr,it,es,ja,ru,de,pt,zh,ko} × {iphone17, iphone16promax, s20e} × {chromium, webkit}`. Project name format: `<locale>__<device>__<engine>`.

## Important constraints

- **Locale is set by the browser**, not URL parameters or in-app language switchers. Tests verify the app responds to `navigator.language` / `Accept-Language`.
- **Playwright WebKit is NOT iOS Safari.** Pixel snapshots on `webkit + iphone17` are an approximation. Known iOS-only quirks (viewport-unit URL bar behavior, input zoom, momentum scrolling, safe-area insets) are not exercised. For iOS-specific bugs, real-device testing is required (out of current scope).
- **xlsx is treated as a frozen snapshot of translations.** Diff between xlsx and live app → bug, not test infrastructure problem.

## Snapshot scope

- Landing: EN × 3 devices × 2 engines + 9 non-EN locales × iPhone 17 × 2 engines = 24 PNGs.
- First survey step: EN only × 3 devices × 2 engines = 6 PNGs.
- Paywall: same as landing = 24 PNGs.
- Total: ~54 baselines.

## Updating translations

1. Replace `WWLI Onboarding Localisation.xlsx` in repo root.
2. Run `npm run i18n:import`.
3. Inspect `git diff tests/fixtures/i18n/*.json`.
4. Run tests; failures show where the app hasn't caught up to new strings.
5. Commit xlsx + JSON fixtures together.

## Architecture

See `docs/superpowers/specs/2026-05-26-e2e-localization-design.md` for the full design rationale.

## Known limitations

- WebKit ≠ iOS Safari (see above).
- iPhone 17 viewport/UA values are based on Apple specs / extrapolation, not real-device measurements.
- Full matrix run is slow (~45 min); use `test:smoke` for fast feedback during development.

````

- [ ] **Step 2: Run final acceptance gate**

Run, in order:
```bash
npm run typecheck
npm run lint
npm run i18n:check
npm run test:smoke
````

Expected: all green.

- [ ] **Step 3: Spot-check three non-trivial locales**

Run:

```bash
npx playwright test --project=de__iphone17__webkit tests/localization/
npx playwright test --project=ja__iphone17__webkit tests/localization/
npx playwright test --project=ru__iphone17__webkit tests/localization/
```

Expected: all PASS. If any fail, investigate before declaring done.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: full README with quickstart, matrix, snapshot scope, limitations"
```

- [ ] **Step 5: Sanity check — was the spec covered?**

Read through `docs/superpowers/specs/2026-05-26-e2e-localization-design.md` section by section. For each section, verify the corresponding task above implemented it. List any gaps in a follow-up task — do not declare done if anything is missing.

The 10 acceptance criteria from spec §12 should now all be satisfied:

| #   | Criterion                                        | Where verified                            |
| --- | ------------------------------------------------ | ----------------------------------------- |
| 1   | Full matrix runs with no setup errors            | Step 2 above                              |
| 2   | Baselines committed and reproducible             | Task 19                                   |
| 3   | Tests deterministic locally (3 consecutive runs) | Run `npm run test:smoke` thrice to verify |
| 4   | xlsx change breaks tests with clear messages     | Verified in Task 8 (importer tests)       |
| 5   | README enables <10 min onboarding                | This task                                 |
| 6   | lint + typecheck green                           | Step 2 above                              |
| 7   | UA-smoke documented                              | Task 21                                   |
| 8   | pt variant resolved                              | Task 21                                   |
| 9   | MAX_STEPS calibrated                             | Task 21                                   |
| 10  | xlsx schema validation works                     | Task 5                                    |

---

## Plan self-review

**Spec coverage:** every section in the spec maps to one or more tasks:

- §1 Scope → all (project's reason for existence)
- §2 Stack → Task 1
- §3 Structure → Tasks 1, 5, 11, 13, 14, 15, 16
- §4 Matrix → Tasks 3, 4, 11, 12
- §5 Importer → Tasks 5–9
- §6 Auth/URL → Tasks 2, 14
- §7 POM → Tasks 14, 15, 16; no-missing-keys spec → Task 18
- §8 Visual → Tasks 14, 19
- §9 Run/scripts/isolation → Tasks 1, 12, 14, 20
- §10 TDD → embedded in every task
- §11 Risks → mitigations live in respective tasks (schema validation, UA smoke, etc.)
- §12 Acceptance → Tasks 21, 22

**Placeholder scan:** no "TBD" or "implement later" tokens in actionable steps. Selectors in SurveyPage are explicitly marked as placeholders to be adapted during step-1 discovery in Task 16, but that's part of the discovery workflow, not deferred work.

**Type consistency:** `Translations`, `ProjectMeta`, `LocaleCode`, `DeviceCode`, `MatrixProject`, `AppEnv` are all defined once and used consistently. Method names (`completeAllSteps`, `isPaywallVisible`, `installCleanState`, `buildSurveyUrl`, `i18n.get`) match between definition and call sites.

**TDD discipline:** every behavior-bearing task has Red → Green → Refactor structure. The two exceptions are Task 14 (utility classes — tested via Task 15) and Task 16 (exploratory; tests fail loud at the live app rather than against unit-tested helpers — this is the right shape for e2e).
