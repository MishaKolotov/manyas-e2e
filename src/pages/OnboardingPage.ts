import { expect, type TestInfo } from '@playwright/test';
import { BasePage } from './BasePage';
import { assertNoHorizontalOverflow, assertNoLeakedKeys, attachScreenshot } from '../utils/checks';
import { loadTranslations } from '../utils/translations';
import { normalizeText } from '../utils/normalize';
import type { LocaleCode } from '../config/locales';
import type { UrlConfig } from '../config/configs';

/**
 * Safety cap on onboarding steps. The live default funnel reaches the paywall
 * in ~22 steps; 60 leaves headroom while still bailing out quickly if
 * detect-and-answer gets stuck.
 */
export const MAX_STEPS = 60;

/** Advance-CTA labels across our 10 locales (extend during calibration). */
const ADVANCE_LABELS =
  /continue|next|done|got it|далее|продолжить|готово|weiter|fertig|continuer|continuar|continua|terminé|fatto|listo|続ける|次へ|完了|다음|완료|继续|完成|下一步/i;

/** Buttons that are navigation/legal/consent chrome, never a survey answer. */
const NON_ANSWER =
  /^(prev|previous|next|back|close|skip|done)$|continue|next|skip|back|prev|close|done|got it|privacy|terms|accept all|accept|allow|cookie|далее|назад|продолжить|готово|weiter|続ける|次へ|完了|다음|继续/i;

/** Metric unit-toggle labels (height cm / weight kg) across our 10 locales. */
const METRIC_UNIT = /^(cm|см|kg|кг|厘米|千克|公斤|センチ|キロ|킬로그램|센티미터)$/i;

/** "Skip" labels for optional screens (e.g. the results-date picker). */
const SKIP_LABELS =
  /skip|пропустить|überspringen|passer|sauter|saltar|salta|スキップ|スキップする|건너뛰기|跳过|跳過/i;

/** Title keys verified as exact-match anchors when their screen is reached. */
const KNOWN_TITLE_KEYS = ['fitnesLevel_title', 'workHard_title'] as const;

/**
 * Title anchors required per config (spec §8.1 exact-match). Extend per config
 * during calibration by adding a key here.
 */
const REQUIRED_TITLE_KEYS: Record<string, readonly string[]> = {
  default: ['fitnesLevel_title'],
  taichiwalking: [],
  japanesewalking: [],
};

export class OnboardingPage extends BasePage {
  /** Navigate to the funnel, wait for the quiz, then dismiss the cookie banner. */
  async goto(config: UrlConfig): Promise<void> {
    await super.goto(config);
    await this.waitForQuizReady();
    // The OneTrust banner renders together with the quiz, so dismiss it AFTER
    // the splash clears; give it a few seconds to appear.
    await this.dismissCookieBanner(8000);
  }

  /**
   * Click the cookie-consent "Accept All" button if the banner is shown. The
   * banner overlays the screen and intercepts answer clicks, so this is also
   * called at the top of every step in case it appears late.
   */
  async dismissCookieBanner(timeout = 0): Promise<void> {
    const accept = this.page.getByRole('button', { name: /^accept all$/i }).first();
    if (await accept.isVisible({ timeout }).catch(() => false)) {
      await accept.click({ timeout: 3000 }).catch(async () => {
        await accept.click({ force: true }).catch(() => undefined);
      });
      await this.page.waitForTimeout(300);
    }
  }

  /** The funnel opens on a "Loading the quiz" splash; wait for it to clear. */
  async waitForQuizReady(): Promise<void> {
    await this.page
      .waitForFunction(() => !document.body.innerText.includes('Loading the quiz'), null, {
        timeout: 30_000,
      })
      .catch(() => undefined);
  }

  /** True once the URL switches from `survey` to the `plan_ready_v2` paywall. */
  async isPaywallReached(): Promise<boolean> {
    return this.page.url().includes('plan_ready_v2');
  }

  /** Pick the first valid answer on the current screen, whatever its type. */
  async answerCurrentStep(): Promise<void> {
    // Measurement screens (height/weight). The unit tabs are localized
    // (CM/KG, см/кг, ...), so match the metric unit across locales and switch
    // to it for a single input. One descending candidate list satisfies height
    // (cm), current weight (kg) and goal weight (< current) without needing to
    // tell them apart — the first value that enables the CTA wins.
    const metric = this.page.getByRole('button', { name: METRIC_UNIT }).first();
    if (await metric.isVisible().catch(() => false)) {
      await metric.click().catch(() => undefined);
      await this.fillMeasurement(['170', '70', '65', '60', '55', '50']);
      return;
    }

    // Generic numeric / text / email input (e.g. age, name, email).
    const input = this.page.locator('input:visible').first();
    if (await input.isVisible().catch(() => false)) {
      const type = await input.getAttribute('type');
      if (type !== 'checkbox' && type !== 'radio') {
        const mode = await input.getAttribute('inputmode');
        const hints =
          ((await input.getAttribute('name')) ?? '') +
          ((await input.getAttribute('autocomplete')) ?? '') +
          ((await input.getAttribute('placeholder')) ?? '');
        const email = type === 'email' || /email|e-mail/i.test(hints);
        const numeric = type === 'number' || mode === 'numeric';
        await input
          .fill(email ? 'qa.tester@example.com' : numeric ? '30' : 'Test')
          .catch(() => undefined);
        return;
      }
    }

    // Slider.
    const slider = this.page.locator('input[type="range"]:visible').first();
    if (await slider.isVisible().catch(() => false)) {
      await slider.press('ArrowRight').catch(() => undefined);
      return;
    }

    // Choice screens: answers are <button> elements. Click the first button
    // whose label is not navigation/legal/consent chrome.
    const buttons = this.page.locator('button:visible');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const b = buttons.nth(i);
      const label = (await b.innerText().catch(() => '')).trim();
      if (!label || NON_ANSWER.test(label)) continue;
      await b.click().catch(() => undefined);
      return;
    }

    // Optional screens (e.g. the results-date scroll-picker) expose no answer
    // button and keep their advance CTA disabled — skip them.
    const skip = this.page.locator('button:visible').filter({ hasText: SKIP_LABELS }).first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => undefined);
      return;
    }
    // Info slide with no answer — advance() will move on.
  }

  private async fillFirstNumberInput(value: string): Promise<void> {
    const input = this.page.locator('input:visible').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill(value).catch(() => undefined);
    }
  }

  /** Fill the measurement input with the first candidate that enables the CTA. */
  private async fillMeasurement(candidates: string[]): Promise<void> {
    for (const value of candidates) {
      await this.fillFirstNumberInput(value);
      await this.page.waitForTimeout(250);
      const cta = this.page.locator('button:visible').filter({ hasText: ADVANCE_LABELS }).first();
      if (await cta.isEnabled().catch(() => false)) return;
    }
  }

  /** Click a visible, enabled advance CTA (Continue/Next/Done) if present. */
  async advance(): Promise<void> {
    // The CTA often appears/enables a moment after an answer is selected.
    const cta = this.page.locator('button:visible').filter({ hasText: ADVANCE_LABELS }).first();
    await cta.waitFor({ state: 'visible', timeout: 1200 }).catch(() => undefined);
    if (await cta.isVisible().catch(() => false)) {
      if (await cta.isEnabled().catch(() => false)) {
        await cta.click().catch(() => undefined);
      }
    }
    // Many screens auto-advance on selection; the heading-change wait in the
    // walk loop is the real transition signal.
  }

  /** Visible heading texts on the current screen (normalized). */
  private async visibleHeadings(): Promise<string[]> {
    const raw = await this.page.evaluate(() => {
      const isVisible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      return [...document.querySelectorAll('h1,h2,h3')]
        .filter(isVisible)
        .map((e) => (e as HTMLElement).innerText.trim())
        .filter(Boolean);
    });
    return raw.map(normalizeText);
  }

  /** Wait until the visible headings differ from `prev`, or time out quietly. */
  private async waitForScreenChange(prev: string): Promise<void> {
    await this.page
      .waitForFunction(
        (previous) => {
          const isVisible = (el: Element) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
          };
          const sig = [...document.querySelectorAll('h1,h2,h3')]
            .filter(isVisible)
            .map((e) => (e as HTMLElement).innerText.trim())
            .filter(Boolean)
            .join(' | ');
          return sig !== previous || location.href.includes('plan_ready_v2');
        },
        prev,
        { timeout: 8000 },
      )
      .catch(() => undefined);
  }

  /**
   * Run per-screen checks (overflow, no leaked keys, screenshot) and record any
   * known title anchor whose translation matches a heading on this screen.
   */
  async checkCurrentScreen(
    testInfo: TestInfo,
    label: string,
    locale: LocaleCode,
    seen: Set<string>,
  ): Promise<void> {
    await assertNoHorizontalOverflow(this.page, label);
    await assertNoLeakedKeys(this.page, label);
    await attachScreenshot(this.page, testInfo, label);

    const t = loadTranslations(locale);
    const headings = await this.visibleHeadings();
    for (const key of KNOWN_TITLE_KEYS) {
      if (seen.has(key)) continue;
      if (headings.includes(normalizeText(t.t(key)))) seen.add(key);
    }
  }

  /**
   * Walk from the current screen to the paywall, checking and screenshotting
   * every step, then assert the config's required title anchors were matched
   * (exact comparison against the spreadsheet). Returns steps consumed.
   */
  async walkToPaywall(testInfo: TestInfo, config: UrlConfig, locale: LocaleCode): Promise<number> {
    const seen = new Set<string>();
    let consumed = 0;

    for (let step = 1; step <= MAX_STEPS; step++) {
      if (await this.isPaywallReached()) break;
      await this.dismissCookieBanner();
      await this.checkCurrentScreen(testInfo, `${config.name} · step ${step}`, locale, seen);

      const before = (await this.visibleHeadings()).join(' | ');
      await this.answerCurrentStep();
      await this.advance();
      await this.waitForScreenChange(before);
      consumed = step;
    }

    expect(
      await this.isPaywallReached(),
      `Hit MAX_STEPS=${MAX_STEPS} for config "${config.name}" without reaching the paywall ` +
        `(survey grew, paywall signal changed, or detect-and-answer got stuck).`,
    ).toBe(true);

    const required = REQUIRED_TITLE_KEYS[config.name] ?? [];
    const missing = required.filter((k) => !seen.has(k));
    expect(
      missing,
      `Title anchors not shown with the correct ${locale} translation for config ` +
        `"${config.name}": ${JSON.stringify(missing)}. Either the screen was skipped or the ` +
        `live copy does not match the spreadsheet.`,
    ).toEqual([]);

    return consumed;
  }
}
