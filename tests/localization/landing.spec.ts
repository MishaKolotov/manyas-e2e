import { test, expect } from '../../src/fixtures/i18n.fixture';
import { LandingPage } from '../../src/pages/LandingPage';
import { assertNoHorizontalOverflow } from '../../src/utils/visual-checks';

/**
 * Landing screen smoke test: the splash must render the localized headline,
 * subtitle, loader, and disclaimer for the project's locale. The screen has
 * no CTA; we additionally assert that the page does not horizontally
 * overflow on the iPhone 17 width even for long-string locales (de, ru).
 *
 * The headline key `intro_text_22` is canonical — the same English copy
 * lives behind a handful of xlsx keys (`intro_text_25`, `result_title_1`,
 * etc), all of which share the translations.
 */
test('landing renders localized headline + subtitle + loader + disclaimer', async ({
  page,
  context,
  i18n,
}) => {
  const landing = await new LandingPage(page, context, i18n).goto();

  await expect(landing.headline).toBeVisible();
  await expect(landing.headline).toContainText(i18n.get('intro_text_22'));

  await expect(landing.subtitle).toBeVisible();
  await expect(landing.loaderText).toBeVisible();
  await expect(landing.disclaimer).toBeVisible();

  await assertNoHorizontalOverflow(page);
});
