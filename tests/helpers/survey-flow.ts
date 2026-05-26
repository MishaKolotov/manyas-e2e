import type { SurveyPage } from '../../src/pages/SurveyPage';

/**
 * Safety cap on survey steps. Live-app discovery showed 9 real-question
 * steps + at least 12 chained "Without vs With Walking app" info slides
 * before timing out — true funnel length is somewhere between 25 and 40
 * steps. 60 gives roughly 1.5× the upper bound while still bailing out
 * quickly if the detect-and-answer loop gets stuck.
 *
 * Tighten this later once a clean walk reports the actual number.
 */
export const MAX_STEPS = 120;

/**
 * Drive `survey` from its current state until the paywall is visible (or
 * MAX_STEPS is exceeded). Returns the number of steps consumed.
 *
 * Algorithm per step:
 * 1. If the paywall signals are present, stop.
 * 2. Detect the screen type (choice / slider / number / text / info).
 * 3. Provide a sensible default answer.
 * 4. If a Continue/Next button is now visible, click it; otherwise rely on
 *    the screen having auto-advanced after the answer.
 * 5. Wait briefly for the next screen to settle.
 */
export async function completeAllSteps(survey: SurveyPage): Promise<number> {
  for (let step = 1; step <= MAX_STEPS; step++) {
    if (await survey.isPaywallVisible()) {
      return step - 1;
    }

    await survey.answerCurrentStep();
    await survey.advance();

    // Give the next screen time to mount and any in-flight network calls a
    // moment to settle. Both are noisy on the dev stand-up.
    await survey.page.waitForLoadState('networkidle').catch(() => undefined);
    await survey.page.waitForTimeout(400);
  }
  throw new Error(
    `Hit MAX_STEPS=${MAX_STEPS} without reaching paywall. Either the survey grew, ` +
      `the paywall signal changed, or the detect-and-answer loop got stuck on a step.`,
  );
}
