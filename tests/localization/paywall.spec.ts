import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { SurveyPage } from '../../src/pages/SurveyPage';
import { PaywallPage } from '../../src/pages/PaywallPage';
import { completeAllSteps } from '../helpers/survey-flow';
import { assertNoHorizontalOverflow } from '../../src/utils/visual-checks';

/**
 * Paywall smoke: drive the funnel to the paywall and assert it renders
 * a heading, a CTA, and at least one price-shaped string. We don't pin the
 * exact currency symbol because the paywall is locale-aware and may show
 * "$ 9.99" or "9,99 €" depending on the project's BCP-47 tag.
 */
test('paywall renders heading + CTA + locale-formatted price', async ({
  page,
  context,
  i18n,
}) => {
  test.setTimeout(300_000);

  const landing = await new LandingPage(page, context, i18n).goto();
  await landing.waitForSplashToTransition();

  const survey = new SurveyPage(page, context, i18n);
  await completeAllSteps(survey);

  const paywall = new PaywallPage(page, context, i18n);
  await expect(paywall.heading).toBeVisible();
  await expect(paywall.cta).toBeVisible();

  // The price block must exist and contain at least one digit grouping next
  // to a currency symbol. This is a regex match on the rendered text node,
  // intentionally permissive: $9.99 / €9,99 / £9.99 / ¥999 all qualify.
  await expect(paywall.priceBlock).toBeVisible();
  await expect(paywall.priceBlock).toContainText(/[$€£¥]\s?\d|\d+[.,]\d{2}\s?[$€£¥]/);

  await assertNoHorizontalOverflow(page);
});
