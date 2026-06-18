import { test } from '@playwright/test';
import { loadEnv } from '../src/config/env';
import { selectedConfigs } from '../src/config/configs';
import { OnboardingPage } from '../src/pages/OnboardingPage';
import type { LocaleCode } from '../src/config/locales';

const env = loadEnv();
const configs = selectedConfigs(process.env.TEST_CONFIG);

for (const config of configs) {
  test(`onboarding renders correctly · config=${config.name}`, async ({ page, context }, testInfo) => {
    // Some funnels (e.g. japanesewalking) run 40+ screens; with a per-screen
    // screenshot and settle this needs well over the default 30s.
    testInfo.setTimeout(300_000);
    const locale = (testInfo.project.metadata as { locale: LocaleCode }).locale;
    const onboarding = new OnboardingPage(page, context, env.baseUrl);
    await onboarding.goto(config);
    await onboarding.walkToPaywall(testInfo, config, locale);
  });
}
