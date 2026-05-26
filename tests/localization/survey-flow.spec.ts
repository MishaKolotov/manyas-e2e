import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { SurveyPage } from '../../src/pages/SurveyPage';
import { PaywallPage } from '../../src/pages/PaywallPage';
import { completeAllSteps } from '../helpers/survey-flow';
import { assertNoHorizontalOverflow } from '../../src/utils/visual-checks';

test('full survey reaches paywall in the current locale', async ({
  page,
  context,
  i18n,
}) => {
  test.setTimeout(300_000);

  const landing = await new LandingPage(page, context, i18n).goto();
  await landing.waitForSplashToTransition();

  const survey = new SurveyPage(page, context, i18n);
  const steps = await completeAllSteps(survey);
  expect(steps, 'should have walked through at least a few survey steps').toBeGreaterThan(0);

  const paywall = new PaywallPage(page, context, i18n);
  await expect(paywall.heading, 'paywall heading must be visible after the survey').toBeVisible();
  await assertNoHorizontalOverflow(page);
});
