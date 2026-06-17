import { expect, type Page, type TestInfo } from '@playwright/test';
import { normalizeText } from './normalize';

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
  expect(normalizeText(actual), `Anchor "${selector}" mismatch at ${where}`).toBe(
    normalizeText(expected),
  );
}
