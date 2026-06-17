import { expect, type TestInfo } from '@playwright/test';
import { BasePage } from './BasePage';
import {
  assertNoHorizontalOverflow,
  assertNoLeakedKeys,
  attachScreenshot,
  expectAnchorText,
} from '../utils/checks';
import { loadTranslations } from '../utils/translations';
import type { LocaleCode } from '../config/locales';

/**
 * Safety cap on onboarding steps. Calibrated in Task 18 to ceil(observed × 1.5).
 * Starts generous so the detect-and-answer loop is not cut short during bring-up.
 */
export const MAX_STEPS = 60;

/** Continue/Next CTA labels across our 10 locales (extend during calibration). */
const NEXT_LABELS =
  /continue|next|start|далее|продолжить|weiter|continuer|continuar|continua|続ける|次へ|다음|继续/i;

export class OnboardingPage extends BasePage {
  /**
   * Stable text anchors for recognized screens: selector → translation key.
   * Extend this as screens are confirmed against the live app (spec §8.1).
   * Calibrate selectors in Task 18.
   */
  private static readonly LANDING_ANCHORS: ReadonlyArray<{ selector: string; key: string }> = [
    { selector: '[data-testid="intro-title"]', key: 'intro_text_1' },
  ];

  /** True once the URL switches from `survey` to the `plan_ready_v2` paywall. */
  async isPaywallReached(): Promise<boolean> {
    return this.page.url().includes('plan_ready_v2');
  }

  /** Pick the first valid answer on the current screen, whatever its type. */
  async answerCurrentStep(): Promise<void> {
    // Single/multi-choice option cards.
    const option = this.page
      .locator('[data-testid="option"], button[role="radio"], .option')
      .first();
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
    const next = this.page.getByRole('button').filter({ hasText: NEXT_LABELS }).first();
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

  /** Exact-match every landing anchor against the locale's translations. */
  async checkLandingAnchors(locale: LocaleCode): Promise<void> {
    const t = loadTranslations(locale);
    for (const anchor of OnboardingPage.LANDING_ANCHORS) {
      await expectAnchorText(this.page, anchor.selector, t.t(anchor.key), `landing:${anchor.key}`);
    }
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
