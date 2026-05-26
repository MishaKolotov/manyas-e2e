import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { SurveyPage } from '../../src/pages/SurveyPage';
import { PaywallPage } from '../../src/pages/PaywallPage';
import { completeAllSteps } from '../helpers/survey-flow';
import { waitForVisualStability } from '../../src/utils/wait-stable';

/**
 * Pixel-snapshot scope (matches spec §8.3):
 *
 * - Landing snapshot: all 10 locales × iPhone 17 × {chromium, webkit}
 *                     PLUS EN × all 3 devices × both engines
 *                     = 24 PNG total.
 * - First survey step: EN only × 3 devices × 2 engines = 6 PNG.
 * - Paywall: same coverage shape as landing = 24 PNG.
 *
 * The skip predicate below collapses non-EN locales onto iPhone 17.
 */
const SNAPSHOT_OPTS = {
  fullPage: true,
  maxDiffPixelRatio: 0.02,
  animations: 'disabled' as const,
  caret: 'hide' as const,
};

test.describe('visual snapshots', () => {
  test('landing', async ({ page, context, i18n, projectMeta }) => {
    test.skip(
      projectMeta.locale !== 'en' && projectMeta.device !== 'iphone17',
      'non-EN locales only snapshot iPhone 17',
    );

    await new LandingPage(page, context, i18n).goto();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot('landing.png', SNAPSHOT_OPTS);
  });

  test('first-survey-step', async ({ page, context, i18n, projectMeta }) => {
    test.skip(projectMeta.locale !== 'en', 'first-survey-step snapshot is EN-only');

    const landing = await new LandingPage(page, context, i18n).goto();
    await landing.waitForSplashToTransition();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot('first-survey-step.png', SNAPSHOT_OPTS);
  });

  test('paywall', async ({ page, context, i18n, projectMeta }) => {
    test.setTimeout(300_000);
    test.skip(
      projectMeta.locale !== 'en' && projectMeta.device !== 'iphone17',
      'non-EN locales only snapshot iPhone 17',
    );

    const landing = await new LandingPage(page, context, i18n).goto();
    await landing.waitForSplashToTransition();
    const survey = new SurveyPage(page, context, i18n);
    await completeAllSteps(survey);
    const paywall = new PaywallPage(page, context, i18n);
    await expect(paywall.heading).toBeVisible();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot('paywall.png', SNAPSHOT_OPTS);
  });
});
