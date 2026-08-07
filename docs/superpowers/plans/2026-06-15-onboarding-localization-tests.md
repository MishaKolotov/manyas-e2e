# Onboarding Localization Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a simple Playwright suite that walks the Walking-Survey onboarding (up to the `plan_ready_v2` paywall signal) across 10 locales × 3 devices × 2 engines × N URL-configs, verifying translations match the spreadsheet and layout does not break, with a per-screen screenshot report aimed at QA without automation experience.

**Architecture:** One `OnboardingPage` POM drives a generic detect-and-answer loop. URL-configs live in one array (`configs.ts`); A/B is forced to variant B. Translations are imported from the exported Google sheet (xlsx) into flat per-locale JSON. Checks are: anchored exact-match against the sheet (with `<br/>`/`\n` normalization), no leaked i18n keys, no horizontal overflow, plus a screenshot of every screen attached to the HTML report. Configs are an inner loop in the single spec, so the Playwright project matrix stays at 60.

**Tech Stack:** TypeScript, Node 20, Playwright Test, `xlsx` (SheetJS), `tsx`, `dotenv`.

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-06-15-onboarding-localization-design.md`
- Live-app discovery notes: `docs/superpowers/notes/survey-flow-discovery.md`

**Note on existing code:** The repo already contains a prior (more complex) implementation built from the superseded 2026-05-26 spec (`SurveyPage.ts`, `PaywallPage.ts`, five spec files, `excel-to-json.ts`, snapshot logic). This plan builds the new simpler structure and **removes the paywall-specific and snapshot-specific code**. Where an existing config file already matches the new design (e.g. `locales.ts`), we adapt it in place rather than rewriting.

---

## File Structure

**Create:**
- `src/config/configs.ts` — URL-config list + URL builder + config selector
- `src/utils/normalize.ts` — text normalization (`<br/>`, `\n`, whitespace)
- `src/utils/translations.ts` — load per-locale JSON, `t(key)` with missing-key error
- `src/utils/checks.ts` — overflow assert, leaked-key detector, screenshot attach, anchored text match
- `src/pages/OnboardingPage.ts` — detect-and-answer + screen anchors + paywall-reached check
- `tests/onboarding.spec.ts` — the single localization spec
- `docs/beginner-guide-ru.md` — "for dummies" guide
- `tests/utils/normalize.test.ts`, `tests/config/configs.test.ts`, `tests/utils/translations.test.ts`, `tests/utils/checks.test.ts` — unit tests

**Modify / adapt:**
- `src/config/env.ts` — drop `surveyPath`/`featureFlags` (configs.ts owns paths now), keep creds + baseUrl
- `src/config/devices.ts` — rename codes `iphone17→iphone17pro`, `s20e→s20`
- `src/config/locales.ts` — keep as-is (already matches spec)
- `src/config/projects.ts` — use `tests/translations` path, keep matrix shape
- `src/utils/excel-to-json.ts` → repurpose as `src/utils/import-translations.ts`, output to `tests/translations/`
- `playwright.config.ts` — reporters (list + html), `testDir: tests`, drop snapshot config
- `package.json` — update scripts (drop snapshot/i18n:check coupling, rename importer)
- `.env.example` — `BASE_URL` + creds only

**Delete (paywall/snapshot baggage from old spec):**
- `src/pages/PaywallPage.ts`, `src/pages/SurveyPage.ts`, `src/pages/LandingPage.ts`
- `tests/localization/*.spec.ts` (all five), `tests/helpers/survey-flow.ts`
- `src/utils/visual-checks.ts`, `src/utils/wait-stable.ts`, `src/utils/i18n-check.ts`, `src/utils/i18n-loader.ts`
- `tests/localization/*-snapshots/` directories

---

## Phase 0 — Scaffolding cleanup

### Task 1: Trim package.json scripts and .env.example

**Files:**
- Modify: `package.json:7-23`
- Modify: `.env.example`

- [ ] **Step 1: Replace the `scripts` block in `package.json`**

```json
  "scripts": {
    "test": "playwright test",
    "test:smoke": "playwright test --project=/en__.*/",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report",
    "test:clean": "rimraf test-results playwright-report",
    "i18n:import": "tsx src/utils/import-translations.ts",
    "lint": "eslint .",
    "format": "prettier --write \"**/*.{ts,json,md}\"",
    "typecheck": "tsc --noEmit",
    "install:browsers": "playwright install --with-deps chromium webkit"
  },
```

(Removed: `pretest`/`i18n:check` coupling, `test:debug`, `test:update-snapshots` — no pixel baselines in this design.)

- [ ] **Step 2: Overwrite `.env.example`**

```
BASIC_AUTH_USER=
BASIC_AUTH_PASS=
BASE_URL=https://dev.slimkit.health
```

- [ ] **Step 3: Verify your local `.env` has the three vars**

Run: `grep -E 'BASIC_AUTH_USER|BASIC_AUTH_PASS|BASE_URL' .env`
Expected: three lines, `BASIC_AUTH_USER=dev`, `BASIC_AUTH_PASS=<ask-the-project-owner>`, `BASE_URL=https://dev.slimkit.health`.

- [ ] **Step 4: Commit**

```bash
git add package.json .env.example
git commit -m "chore: trim scripts and env to onboarding-only scope"
```

### Task 2: Delete superseded paywall/snapshot code

**Files:**
- Delete: see list below

- [ ] **Step 1: Remove old POM, specs, helpers, snapshot utils**

```bash
git rm src/pages/PaywallPage.ts src/pages/SurveyPage.ts src/pages/LandingPage.ts \
  src/utils/visual-checks.ts src/utils/wait-stable.ts src/utils/i18n-check.ts src/utils/i18n-loader.ts \
  tests/helpers/survey-flow.ts \
  tests/localization/landing.spec.ts tests/localization/survey-flow.spec.ts \
  tests/localization/paywall.spec.ts tests/localization/no-missing-keys.spec.ts \
  tests/localization/visual.spec.ts
rm -rf tests/localization/*-snapshots
```

- [ ] **Step 2: Verify the source tree is clean**

Run: `ls src/pages src/utils tests`
Expected: `src/pages/BasePage.ts` only; `src/utils` still has `excel-to-json.ts`; no `tests/localization` specs remain.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove superseded paywall and snapshot code"
```

---

## Phase 1 — Pure utilities (strict TDD)

### Task 3: Text normalization

**Files:**
- Create: `src/utils/normalize.ts`
- Test: `tests/utils/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from '@playwright/test';
import { normalizeText } from '../../src/utils/normalize';

test('strips <br/> and <br> to a single space', () => {
  expect(normalizeText('Improve my<br/>health for life')).toBe('Improve my health for life');
  expect(normalizeText('a<br>b')).toBe('a b');
});

test('collapses newlines, tabs and repeated spaces, then trims', () => {
  expect(normalizeText('How long\ndoes it\t take?')).toBe('How long does it take?');
  expect(normalizeText('  Walking   ')).toBe('Walking');
});

test('replaces non-breaking spaces with normal spaces', () => {
  expect(normalizeText('12,99 €')).toBe('12,99 €');
});

test('returns empty string for empty/whitespace input', () => {
  expect(normalizeText('   ')).toBe('');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/utils/normalize.test.ts`
Expected: FAIL — `Cannot find module '../../src/utils/normalize'`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Normalize a string for exact translation comparison. Applied to BOTH the
 * value scraped from the DOM and the value from the spreadsheet, so that
 * spreadsheet markup (`<br/>`, literal `\n`) lines up with rendered text.
 */
export function normalizeText(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, ' ') // <br/> and <br> → space
    .replace(/ /g, ' ') // non-breaking space → space
    .replace(/[\n\r\t]+/g, ' ') // newlines/tabs → space
    .replace(/\s+/g, ' ') // collapse runs of whitespace
    .trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/utils/normalize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/normalize.ts tests/utils/normalize.test.ts
git commit -m "feat: add text normalization for translation comparison"
```

### Task 4: URL-config list, builder, and selector

**Files:**
- Create: `src/config/configs.ts`
- Test: `tests/config/configs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from '@playwright/test';
import { CONFIGS, buildConfigUrl, selectedConfigs } from '../../src/config/configs';

const BASE = 'https://dev.slimkit.health';

test('CONFIGS has unique names', () => {
  const names = CONFIGS.map((c) => c.name);
  expect(new Set(names).size).toBe(names.length);
});

test('buildConfigUrl appends the config params and forces variant B', () => {
  const cfg = CONFIGS.find((c) => c.name === 'default')!;
  const url = new URL(buildConfigUrl(cfg, BASE));
  expect(url.pathname).toBe('/walking/survey/');
  expect(url.searchParams.get('stripeV64')).toBe('true');
  expect(url.searchParams.get('AValue')).toBe('0');
  expect(url.searchParams.get('BValue')).toBe('100');
});

test('buildConfigUrl preserves config-specific params', () => {
  const cfg = CONFIGS.find((c) => c.name === 'japanesewalking')!;
  const url = new URL(buildConfigUrl(cfg, BASE));
  expect(url.searchParams.get('config')).toBe('taichiwalking');
  expect(url.searchParams.get('japaneseWalkingMethod')).toBe('true');
});

test('selectedConfigs returns all configs when TEST_CONFIG unset', () => {
  expect(selectedConfigs(undefined)).toHaveLength(CONFIGS.length);
});

test('selectedConfigs filters by TEST_CONFIG', () => {
  const got = selectedConfigs('taichiwalking');
  expect(got).toHaveLength(1);
  expect(got[0].name).toBe('taichiwalking');
});

test('selectedConfigs throws on unknown TEST_CONFIG', () => {
  expect(() => selectedConfigs('nope')).toThrow(/unknown config/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/config/configs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface UrlConfig {
  /** Stable id used in test titles and TEST_CONFIG filtering. */
  name: string;
  /** Path under BASE_URL. */
  path: string;
  /** Query string (without leading `?`), config-specific flags. */
  params: string;
}

/**
 * Force the B branch of every A/B test. Set FORCE_B to false to test the A
 * branch instead.
 */
export const FORCE_B = true;
const FORCE_B_PARAMS = 'AValue=0&BValue=100';

/**
 * All URL variants under test. To add a funnel, add one line here.
 */
export const CONFIGS: readonly UrlConfig[] = [
  { name: 'default', path: '/walking/survey/', params: 'stripeV64=true' },
  { name: 'taichiwalking', path: '/walking/survey/', params: 'config=taichiwalking&stripeV64=true' },
  {
    name: 'japanesewalking',
    path: '/walking/survey/',
    params: 'config=taichiwalking&stripeV64=true&japaneseWalkingMethod=true',
  },
] as const;

/** Build the absolute URL for a config against baseUrl, forcing variant B. */
export function buildConfigUrl(config: UrlConfig, baseUrl: string): string {
  const url = new URL(config.path, baseUrl);
  const params = new URLSearchParams(config.params);
  if (FORCE_B) {
    for (const [k, v] of new URLSearchParams(FORCE_B_PARAMS)) params.set(k, v);
  }
  for (const [k, v] of params) url.searchParams.set(k, v);
  return url.toString();
}

/** Pick which configs to run. Undefined → all; otherwise filter by name. */
export function selectedConfigs(testConfig: string | undefined): readonly UrlConfig[] {
  if (!testConfig) return CONFIGS;
  const found = CONFIGS.filter((c) => c.name === testConfig);
  if (found.length === 0) {
    throw new Error(
      `Unknown config "${testConfig}". Valid: ${CONFIGS.map((c) => c.name).join(', ')}.`,
    );
  }
  return found;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/config/configs.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/configs.ts tests/config/configs.test.ts
git commit -m "feat: add URL-config list, builder, and selector"
```

---

## Phase 2 — Config adaptation

### Task 5: Simplify env.ts to creds + baseUrl

**Files:**
- Modify: `src/config/env.ts`
- Test: `tests/config/env.test.ts` (already exists; update expectations)

- [ ] **Step 1: Update the test to expect only three vars**

Open `tests/config/env.test.ts`. Replace any assertions referencing `surveyPath` or `featureFlags` with the three-field shape:

```ts
import { test, expect } from '@playwright/test';
import { loadEnv } from '../../src/config/env';

test('loadEnv returns creds and baseUrl when present', () => {
  process.env.BASIC_AUTH_USER = 'dev';
  process.env.BASIC_AUTH_PASS = 'secret';
  process.env.BASE_URL = 'https://dev.slimkit.health';
  const env = loadEnv();
  expect(env).toEqual({
    basicAuthUser: 'dev',
    basicAuthPass: 'secret',
    baseUrl: 'https://dev.slimkit.health',
  });
});

test('loadEnv throws listing missing vars', () => {
  delete process.env.BASIC_AUTH_USER;
  delete process.env.BASIC_AUTH_PASS;
  delete process.env.BASE_URL;
  expect(() => loadEnv()).toThrow(/Missing required env vars/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/config/env.test.ts`
Expected: FAIL — current `loadEnv` returns `surveyPath`/`featureFlags`.

- [ ] **Step 3: Replace `src/config/env.ts`**

```ts
import 'dotenv/config';

export interface AppEnv {
  basicAuthUser: string;
  basicAuthPass: string;
  baseUrl: string;
}

const REQUIRED_VARS = ['BASIC_AUTH_USER', 'BASIC_AUTH_PASS', 'BASE_URL'] as const;

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
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/config/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts tests/config/env.test.ts
git commit -m "refactor: env holds only creds and baseUrl"
```

### Task 6: Rename device codes to match real devices

**Files:**
- Modify: `src/config/devices.ts:1,21,29,37`
- Test: `tests/config/devices.test.ts` (update code expectations)

- [ ] **Step 1: Update the device test codes**

In `tests/config/devices.test.ts`, change any `'iphone17'`→`'iphone17pro'` and `'s20e'`→`'s20'`. Ensure a test asserts the three codes:

```ts
import { test, expect } from '@playwright/test';
import { DEVICES } from '../../src/config/devices';

test('exposes the three target devices', () => {
  expect(DEVICES.map((d) => d.code)).toEqual(['iphone17pro', 'iphone16promax', 's20']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/config/devices.test.ts`
Expected: FAIL — codes are still `iphone17`/`s20e`.

- [ ] **Step 3: Edit `src/config/devices.ts`**

Change the type and the two codes:

```ts
export type DeviceCode = 'iphone17pro' | 'iphone16promax' | 's20';
```

In the `DEVICES` array set `code: 'iphone17pro'` for the first entry and `code: 's20'` for the Samsung entry. Leave viewports, DSR, and UA strings unchanged (still approximations; see spec §5 risk note). Update the Samsung viewport height to `800` to match the S20 spec:

```ts
  {
    code: 's20',
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    userAgent: SAMSUNG_UA,
    hasTouch: true,
    isMobile: true,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/config/devices.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/devices.ts tests/config/devices.test.ts
git commit -m "refactor: rename device codes to iphone17pro and s20"
```

---

## Phase 3 — Translations

### Task 7: Repurpose the importer to output tests/translations

**Files:**
- Rename: `src/utils/excel-to-json.ts` → `src/utils/import-translations.ts`
- Test: `tests/utils/import-translations.test.ts` (rename from `excel-to-json.test.ts`)

**Context:** The existing `excel-to-json.ts` already implements the skip rules, Sheet3-wins dedup, Sheet2 slugify, and `_meta.json` logging described in spec §6. We keep that logic and only change the **output directory** to `tests/translations/` and the script name.

- [ ] **Step 1: Move the files with git**

```bash
git mv src/utils/excel-to-json.ts src/utils/import-translations.ts
git mv tests/utils/excel-to-json.test.ts tests/utils/import-translations.test.ts
```

- [ ] **Step 2: Update the output path inside `import-translations.ts`**

Find the constant pointing at the output dir (currently `tests/fixtures/i18n`) and change it to `tests/translations`. Update the import in `import-translations.test.ts` to the new module path. If the test asserts the output dir string, update it to `tests/translations`.

- [ ] **Step 3: Run the importer unit test**

Run: `npx playwright test tests/utils/import-translations.test.ts`
Expected: PASS (uses the committed `tests/utils/__importer-test-input.xlsx` fixture).

- [ ] **Step 4: Run a real import and inspect**

Run: `npm run i18n:import`
Expected: writes `tests/translations/{en,fr,it,es,ja,ru,de,pt,zh,ko}.json` + `_meta.json`; prints a summary of imported/skipped/duplicate counts.

- [ ] **Step 5: Move existing fixtures and commit**

```bash
git rm -r tests/fixtures/i18n
git add tests/translations src/utils/import-translations.ts tests/utils/import-translations.test.ts
git commit -m "refactor: importer outputs to tests/translations"
```

### Task 8: Translations loader

**Files:**
- Create: `src/utils/translations.ts`
- Test: `tests/utils/translations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from '@playwright/test';
import { loadTranslations } from '../../src/utils/translations';

test('loads a locale map and resolves keys', () => {
  const t = loadTranslations('en');
  expect(typeof t.t('intro_text_0')).toBe('string');
  expect(t.t('intro_text_0').length).toBeGreaterThan(0);
});

test('throws a clear error for a missing key', () => {
  const t = loadTranslations('en');
  expect(() => t.t('definitely_missing_key_xyz')).toThrow(/missing translation key/i);
});

test('has returns false for unknown key without throwing', () => {
  const t = loadTranslations('en');
  expect(t.has('definitely_missing_key_xyz')).toBe(false);
  expect(t.has('intro_text_0')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/utils/translations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/utils/translations.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/translations.ts tests/utils/translations.test.ts
git commit -m "feat: add per-locale translations loader"
```

---

## Phase 4 — Checks

### Task 9: Leaked-key detector (pure regex)

**Files:**
- Create: `src/utils/checks.ts` (first export)
- Test: `tests/utils/checks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/utils/checks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `looksLikeLeakedKey` in `src/utils/checks.ts`**

```ts
/**
 * Heuristic: does this visible string look like a raw i18n key or an
 * unfilled template placeholder rather than translated copy?
 *
 * A leaked key is all ASCII letters/digits/_/. with at least one `_` or `.`
 * separator (matches snake_case, camelCase, dotted) and length 4–80. The
 * separator requirement excludes single words like "email"/"ok".
 */
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_.]*[._][a-zA-Z0-9_.]+$/;
const PLACEHOLDER_RE = /\{\{[^}]+\}\}/;

export function looksLikeLeakedKey(text: string): boolean {
  const s = text.trim();
  if (PLACEHOLDER_RE.test(s)) return true;
  if (s.length < 4 || s.length > 80) return false;
  return KEY_RE.test(s);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/utils/checks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/checks.ts tests/utils/checks.test.ts
git commit -m "feat: add leaked-key detector"
```

### Task 10: Page checks — overflow, leaked-key scan, screenshot attach

**Files:**
- Modify: `src/utils/checks.ts` (add Playwright-aware helpers)

These helpers operate on a live `Page` so they are exercised by the spec in Phase 7 rather than a unit test.

- [ ] **Step 1: Append to `src/utils/checks.ts`**

```ts
import { expect, type Page, type TestInfo } from '@playwright/test';
import { normalizeText } from './normalize';

/** Fail if the document scrolls horizontally (a classic long-string overflow). */
export async function assertNoHorizontalOverflow(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, `Horizontal overflow of ${overflow}px at ${where}`).toBeLessThanOrEqual(1);
}

/** Scan all visible text nodes for leaked i18n keys; fail listing offenders. */
export async function assertNoLeakedKeys(page: Page, where: string): Promise<void> {
  const texts = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const s = (n.textContent ?? '').trim();
      if (s) out.push(s);
    }
    return out;
  });
  const leaked = texts.filter((t) => looksLikeLeakedKey(t));
  expect(leaked, `Leaked i18n keys at ${where}: ${JSON.stringify(leaked)}`).toEqual([]);
}

/** Attach a full-page screenshot of the current screen to the HTML report. */
export async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const buf = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, { body: buf, contentType: 'image/png' });
}

/** Exact, normalized comparison of a locator's text against an expected string. */
export async function expectAnchorText(
  page: Page,
  selector: string,
  expected: string,
  where: string,
): Promise<void> {
  const actual = await page.locator(selector).first().innerText();
  expect(
    normalizeText(actual),
    `Anchor "${selector}" mismatch at ${where}`,
  ).toBe(normalizeText(expected));
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/checks.ts
git commit -m "feat: add overflow, leaked-key, screenshot, anchor-text page checks"
```

---

## Phase 5 — Playwright wiring

### Task 11: Update the project matrix

**Files:**
- Modify: `src/config/projects.ts`
- Test: `tests/config/projects.test.ts`

- [ ] **Step 1: Update the matrix test expectations**

Ensure `tests/config/projects.test.ts` asserts 60 unique projects and the new naming (`<locale>__<device>__<engine>`), e.g.:

```ts
import { test, expect } from '@playwright/test';
import { buildProjects } from '../../src/config/projects';

const env = { basicAuthUser: 'u', basicAuthPass: 'p', baseUrl: 'https://x' };

test('builds 60 uniquely named projects', () => {
  const projects = buildProjects(env);
  expect(projects).toHaveLength(60);
  expect(new Set(projects.map((p) => p.name)).size).toBe(60);
  expect(projects.some((p) => p.name === 'ru__iphone17pro__webkit')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/config/projects.test.ts`
Expected: FAIL — old code referenced `surveyPath`/`featureFlags` on env and old device codes.

- [ ] **Step 3: Edit `src/config/projects.ts`**

The `AppEnv` import no longer has `surveyPath`/`featureFlags`; the `use` block must not reference them (URL is built per-test from configs, not here). Keep the matrix loop unchanged; ensure `metadata` carries `locale`, `device`, `engine`. Final `use` block per project:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/config/projects.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/projects.ts tests/config/projects.test.ts
git commit -m "refactor: matrix builds 60 projects without per-run URL flags"
```

### Task 12: Playwright config

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: Replace `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';
import { loadEnv } from './src/config/env';
import { buildProjects } from './src/config/projects';

const env = loadEnv();

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : '50%',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  outputDir: 'test-results',
  projects: buildProjects(env),
});
```

- [ ] **Step 2: Confirm the matrix materializes**

Run: `npx playwright test --list | tail -5 && npx playwright test --list | grep -c '__'`
Expected: project ids like `ru__iphone17pro__webkit`; the unit tests in `tests/config` and `tests/utils` also appear (they run on every project — that is fine, they are fast and pure).

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: playwright config with list+html reporters, no snapshots"
```

> **Note on unit tests inside `tests/`:** the pure-logic tests (`tests/config/*`, `tests/utils/*`) would otherwise run once per project (×60). Keep them fast and deterministic; if runtime becomes a problem, move them under a dedicated `unit` project with `testMatch` and exclude that pattern from the matrix projects. Not required for first delivery.

---

## Phase 6 — Page Object Model

### Task 13: BasePage — navigation and state isolation

**Files:**
- Modify: `src/pages/BasePage.ts`

- [ ] **Step 1: Replace `src/pages/BasePage.ts`**

```ts
import type { Page, BrowserContext } from '@playwright/test';
import type { UrlConfig } from '../config/configs';
import { buildConfigUrl } from '../config/configs';

export class BasePage {
  constructor(
    protected readonly page: Page,
    protected readonly context: BrowserContext,
    protected readonly baseUrl: string,
  ) {}

  /** Clear funnel progress (localStorage/sessionStorage) before any page script runs. */
  async installCleanState(): Promise<void> {
    await this.context.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* storage may be unavailable on about:blank */
      }
    });
    await this.context.clearCookies();
  }

  /** Navigate to the given config's onboarding entry URL (variant B forced). */
  async goto(config: UrlConfig): Promise<void> {
    await this.installCleanState();
    await this.page.goto(buildConfigUrl(config, this.baseUrl), { waitUntil: 'domcontentloaded' });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/BasePage.ts
git commit -m "feat: BasePage with clean-state navigation per config"
```

### Task 14: OnboardingPage — detect-and-answer + paywall stop + anchors

**Files:**
- Create: `src/pages/OnboardingPage.ts`

**Context:** Selectors below are a starting point and MUST be calibrated against the live app during Task 18 (the discovery walk). The detect-and-answer strategy mirrors the old `survey-flow.ts` (see `docs/superpowers/notes/survey-flow-discovery.md`) but stops at the paywall instead of asserting it.

- [ ] **Step 1: Create `src/pages/OnboardingPage.ts`**

```ts
import { expect, type Page, type TestInfo } from '@playwright/test';
import { BasePage } from './BasePage';
import {
  assertNoHorizontalOverflow,
  assertNoLeakedKeys,
  attachScreenshot,
} from '../utils/checks';

/**
 * Safety cap on onboarding steps. Calibrated in Task 18 to ceil(observed × 1.5).
 * Starts generous so the detect-and-answer loop is not cut short during bring-up.
 */
export const MAX_STEPS = 60;

export class OnboardingPage extends BasePage {
  /** True once the URL switches from `survey` to the `plan_ready_v2` paywall. */
  async isPaywallReached(): Promise<boolean> {
    return this.page.url().includes('plan_ready_v2');
  }

  /** Pick the first valid answer on the current screen, whatever its type. */
  async answerCurrentStep(): Promise<void> {
    // Single/multi-choice option cards.
    const option = this.page.locator('[data-testid="option"], button[role="radio"], .option').first();
    if (await option.isVisible().catch(() => false)) {
      await option.click();
      return;
    }
    // Numeric / text input (height, weight, age, name).
    const input = this.page.locator('input:visible').first();
    if (await input.isVisible().catch(() => false)) {
      const type = await input.getAttribute('type');
      await input.fill(type === 'number' ? '30' : 'Test');
      return;
    }
    // Slider.
    const slider = this.page.locator('input[type="range"]:visible').first();
    if (await slider.isVisible().catch(() => false)) {
      await slider.press('ArrowRight');
      return;
    }
    // Info slide with no input — nothing to answer; advance() will continue.
  }

  /** Click the continue/next CTA if present; otherwise rely on auto-advance. */
  async advance(): Promise<void> {
    const next = this.page
      .getByRole('button')
      .filter({ hasText: /continue|next|start|далее|продолжить|weiter|continуer|continuar|続ける|다음|继续/i })
      .first();
    if (await next.isEnabled().catch(() => false)) {
      await next.click();
    }
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
  }

  /** Run per-screen checks: overflow, no leaked keys, and attach a screenshot. */
  async checkCurrentScreen(testInfo: TestInfo, label: string): Promise<void> {
    await assertNoHorizontalOverflow(this.page, label);
    await assertNoLeakedKeys(this.page, label);
    await attachScreenshot(this.page, testInfo, label);
  }

  /**
   * Walk from the current screen to the paywall, running checks and attaching a
   * screenshot at every step. Returns the number of steps consumed.
   */
  async walkToPaywall(testInfo: TestInfo, configName: string): Promise<number> {
    for (let step = 1; step <= MAX_STEPS; step++) {
      if (await this.isPaywallReached()) return step - 1;
      await this.checkCurrentScreen(testInfo, `${configName} · step ${step}`);
      await this.answerCurrentStep();
      await this.advance();
    }
    expect(
      await this.isPaywallReached(),
      `Hit MAX_STEPS=${MAX_STEPS} for config "${configName}" without reaching the paywall ` +
        `(survey grew, paywall signal changed, or detect-and-answer got stuck).`,
    ).toBe(true);
    return MAX_STEPS;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/OnboardingPage.ts
git commit -m "feat: OnboardingPage detect-and-answer walking to paywall"
```

---

## Phase 7 — The spec

### Task 15: onboarding.spec.ts

**Files:**
- Create: `tests/onboarding.spec.ts`

- [ ] **Step 1: Create `tests/onboarding.spec.ts`**

```ts
import { test } from '@playwright/test';
import { loadEnv } from '../src/config/env';
import { selectedConfigs } from '../src/config/configs';
import { OnboardingPage } from '../src/pages/OnboardingPage';

const env = loadEnv();
const configs = selectedConfigs(process.env.TEST_CONFIG);

for (const config of configs) {
  test(`onboarding renders correctly · config=${config.name}`, async ({ page, context }, testInfo) => {
    const onboarding = new OnboardingPage(page, context, env.baseUrl);
    await onboarding.goto(config);
    await onboarding.walkToPaywall(testInfo, config.name);
  });
}
```

- [ ] **Step 2: Smoke-run one project, one config, headed**

Run: `TEST_CONFIG=default npx playwright test tests/onboarding.spec.ts --project=en__iphone17pro__chromium --headed`
Expected: the funnel walks to the paywall; the test passes. If a step gets stuck, note the screen and refine `answerCurrentStep`/`advance` selectors (Task 18).

- [ ] **Step 3: Commit**

```bash
git add tests/onboarding.spec.ts
git commit -m "feat: onboarding localization spec looping over configs"
```

### Task 16: Add anchored exact-match for the landing screen

**Files:**
- Modify: `src/pages/OnboardingPage.ts`
- Modify: `tests/onboarding.spec.ts`

**Context:** Anchors are the exact-comparison core (spec §8.1). Start with the most stable screen — the intro/landing — then extend during calibration. Each anchor is `{ selector, key }`; the assertion is `normalizeText(visible) === normalizeText(translation)`.

- [ ] **Step 1: Add an anchors map and checker to `OnboardingPage`**

```ts
import { expectAnchorText } from '../utils/checks';
import { loadTranslations } from '../utils/translations';
import type { LocaleCode } from '../config/locales';

// Append inside the OnboardingPage class:

  /**
   * Stable text anchors for recognized screens: selector → translation key.
   * Extend this as screens are confirmed against the live app (spec §8.1).
   * Calibrate selectors in Task 18.
   */
  private static readonly LANDING_ANCHORS: ReadonlyArray<{ selector: string; key: string }> = [
    { selector: '[data-testid="intro-title"]', key: 'intro_text_1' },
  ];

  /** Exact-match every landing anchor against the locale's translations. */
  async checkLandingAnchors(locale: LocaleCode): Promise<void> {
    const t = loadTranslations(locale);
    for (const anchor of OnboardingPage.LANDING_ANCHORS) {
      await expectAnchorText(this.page, anchor.selector, t.t(anchor.key), `landing:${anchor.key}`);
    }
  }
```

- [ ] **Step 2: Call it from the spec before walking**

In `tests/onboarding.spec.ts`, pass the locale (from project metadata) and check landing anchors:

```ts
import { test } from '@playwright/test';
import { loadEnv } from '../src/config/env';
import { selectedConfigs } from '../src/config/configs';
import { OnboardingPage } from '../src/pages/OnboardingPage';
import type { LocaleCode } from '../src/config/locales';

const env = loadEnv();
const configs = selectedConfigs(process.env.TEST_CONFIG);

for (const config of configs) {
  test(`onboarding renders correctly · config=${config.name}`, async ({ page, context }, testInfo) => {
    const locale = (testInfo.project.metadata as { locale: LocaleCode }).locale;
    const onboarding = new OnboardingPage(page, context, env.baseUrl);
    await onboarding.goto(config);
    await onboarding.checkLandingAnchors(locale);
    await onboarding.walkToPaywall(testInfo, config.name);
  });
}
```

- [ ] **Step 3: Verify the anchor matches on EN, then deliberately break it**

Run: `TEST_CONFIG=default npx playwright test tests/onboarding.spec.ts --project=en__iphone17pro__chromium`
Expected: PASS. Then temporarily change the anchor `key` to a wrong value and re-run; expected: FAIL naming `landing:intro_text_1`. Revert the key.

- [ ] **Step 4: Commit**

```bash
git add src/pages/OnboardingPage.ts tests/onboarding.spec.ts
git commit -m "feat: anchored exact-match on the landing screen"
```

---

## Phase 8 — Documentation

### Task 17: README + beginner guide

**Files:**
- Modify: `README.md`
- Create: `docs/beginner-guide-ru.md`

- [ ] **Step 1: Rewrite `README.md`** to describe the onboarding-only scope, the 60-project matrix, the config list, `TEST_CONFIG`, the translation-import workflow, and where to read the HTML report. State the constraints from spec §13 (WebKit ≠ iOS Safari; Meta browsers manual; UA approximations).

- [ ] **Step 2: Write `docs/beginner-guide-ru.md`** — the copy-paste, step-by-step Russian guide covering the seven points in spec §12 (install, `.env`, changing links/devices, new translations, running, reading the report, fixing a simple break).

- [ ] **Step 3: Commit**

```bash
git add README.md docs/beginner-guide-ru.md
git commit -m "docs: onboarding-only README and Russian beginner guide"
```

---

## Phase 9 — Live calibration (manual, against dev stand)

### Task 18: Calibrate selectors, anchors, MAX_STEPS, pt-variant

**Files:**
- Modify: `src/pages/OnboardingPage.ts`, `src/config/locales.ts`

This task is hands-on against the live dev app (creds `dev` / `<ask-the-project-owner>`). Do it in headed mode.

- [ ] **Step 1: Walk each config once in EN, headed, and confirm the loop reaches the paywall**

Run: `for c in default taichiwalking japanesewalking; do TEST_CONFIG=$c npx playwright test tests/onboarding.spec.ts --project=en__iphone17pro__chromium --headed; done`
Record the step count per config. Fix `answerCurrentStep`/`advance` selectors for any screen that stalls (different first/second screens: age vs gender).

- [ ] **Step 2: Set `MAX_STEPS`** in `OnboardingPage.ts` to `ceil(maxObserved × 1.5)` with a comment stating the observed maximum.

- [ ] **Step 3: Confirm/replace the landing anchor selector** (`data-testid="intro-title"`) with the real one from the live DOM; add 1–2 more stable anchors (CTA, subtitle) if available.

- [ ] **Step 4: Resolve pt-PT vs pt-BR** — open the app with `Accept-Language: pt-PT` and `pt-BR`, compare rendered copy against `tests/translations/pt.json`, and set the correct `bcp47`/`timezone` in `locales.ts` (remove the TBD note).

- [ ] **Step 5: Run RU/DE/JA/ZH/KO on iphone17pro/chromium** for `default` and fix any locale-sensitive selector assumptions surfaced by overflow/anchor failures.

- [ ] **Step 6: Commit**

```bash
git add src/pages/OnboardingPage.ts src/config/locales.ts
git commit -m "chore: calibrate selectors, MAX_STEPS, anchors, and pt locale against live app"
```

### Task 19: Full smoke and report read-through

- [ ] **Step 1: Run the EN smoke across all devices/engines, all configs**

Run: `npm run test:smoke`
Expected: green; HTML report has a screenshot attachment per step for each project.

- [ ] **Step 2: Open the report and eyeball screenshots**

Run: `npm run test:report`
Confirm: every onboarding screen is captured; no leaked keys; no obvious overflow. File issues for any real localization bugs found (these are app bugs, not test bugs).

- [ ] **Step 3: Commit any whitelist/anchor adjustments**

```bash
git add -A
git commit -m "chore: finalize anchors and report read-through"
```

---

## Self-Review notes

- **Spec coverage:** §1 scope → Tasks 1–2, 15, 18; §4 configs/A-B → Task 4; §5 matrix/locale-by-browser → Tasks 6, 11, 12; §6 importer → Task 7; §7 detect-and-answer/paywall-stop → Task 14; §8 anchored exact-match + normalization + overflow + screenshots → Tasks 3, 9, 10, 16; §9 POM rules → Tasks 13, 14; §10 scripts/env → Tasks 1, 5; §11 report → Tasks 12, 19; §12 beginner guide → Task 17; §13 risks → Task 17 (README) + Task 18 (pt, UA); §14 success criteria → Tasks 18, 19.
- **Open calibration items** (inherent to e2e against a live app) are concentrated in Task 18 and flagged as such, not hidden as placeholders.
- **Type consistency:** `UrlConfig`, `buildConfigUrl`, `selectedConfigs`, `loadTranslations().t/has/all`, `normalizeText`, `looksLikeLeakedKey`, `assertNoHorizontalOverflow`, `assertNoLeakedKeys`, `attachScreenshot`, `expectAnchorText`, `MAX_STEPS` are defined once and referenced consistently.
