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

// Match identifier-looking strings: ASCII letters + digits + _/., must have
// at least one `_` or `.` separator so single English words (`email`, `ok`)
// don't trip it.
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
  // Restrict to visible text inside the React root to skip OneTrust noise.
  const visibleStrings = await page.evaluate(() => {
    const root = document.querySelector('#root');
    if (!root) return [] as string[];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const out: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const t = (node.nodeValue ?? '').trim();
      if (t) out.push(t);
    }
    return out;
  });
  return {
    leakedKeys: visibleStrings.filter(isLeakedKey),
    placeholders: visibleStrings.filter((t) => PLACEHOLDER_RE.test(t)),
  };
}

test('no unresolved i18n keys or template placeholders visible during survey', async ({
  page,
  context,
  i18n,
}) => {
  test.setTimeout(300_000);

  const landing = await new LandingPage(page, context, i18n).goto();

  const onLanding = await scrapeViolations(page);
  expect(onLanding.leakedKeys, 'leaked keys on landing splash').toEqual([]);
  expect(onLanding.placeholders, 'template placeholders on landing splash').toEqual([]);

  await landing.waitForSplashToTransition();
  const survey = new SurveyPage(page, context, i18n);

  // Sample the first five survey steps in detail. We don't scrape every
  // single screen of the funnel — that doubles the runtime — but five steps
  // is enough to catch a per-screen leak pattern.
  for (let i = 0; i < 5; i++) {
    if (await survey.isPaywallVisible()) break;
    const v = await scrapeViolations(page);
    expect(v.leakedKeys, `leaked keys on survey step ${i + 1}`).toEqual([]);
    expect(v.placeholders, `placeholders on survey step ${i + 1}`).toEqual([]);
    await survey.answerCurrentStep();
    await survey.advance();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(400);
  }

  await completeAllSteps(survey);
  const onPaywall = await scrapeViolations(page);
  expect(onPaywall.leakedKeys, 'leaked keys on paywall').toEqual([]);
  expect(onPaywall.placeholders, 'template placeholders on paywall').toEqual([]);
});
