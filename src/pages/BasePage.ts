import type { BrowserContext, Page } from '@playwright/test';
import type { Translations } from '../utils/i18n-loader';
import { loadEnv } from '../config/env';
import { waitForVisualStability } from '../utils/wait-stable';

export class BasePage {
  protected readonly env = loadEnv();

  constructor(
    public readonly page: Page,
    public readonly context: BrowserContext,
    public readonly i18n: Translations,
  ) {}

  /**
   * Install per-page storage cleanup BEFORE any script runs. Idempotent.
   *
   * Also seeds the OneTrust consent cookies on the base URL's host so the
   * cookie banner stays out of the way during the funnel. The live app uses
   * OneTrust for consent, and the banner sticks to the bottom of the screen
   * — without dismissal it occludes survey Continue buttons on the iPhone
   * 17 viewport. Pre-seeding `OptanonAlertBoxClosed` tells the SDK the user
   * already responded, so the UI never mounts.
   */
  async installCleanState(): Promise<void> {
    await this.context.clearCookies();
    const baseHost = new URL(this.env.baseUrl).hostname;
    await this.context.addCookies([
      {
        name: 'OptanonAlertBoxClosed',
        value: new Date().toISOString(),
        domain: baseHost,
        path: '/',
      },
    ]);
    await this.context.addInitScript(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).localStorage?.clear?.();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).sessionStorage?.clear?.();
      } catch {
        // ignore: some pages restrict storage access pre-navigation
      }
    });
  }

  buildSurveyUrl(): string {
    const url = new URL(this.env.surveyPath, this.env.baseUrl);
    const flags = new URLSearchParams(this.env.featureFlags ?? '');
    for (const [k, v] of flags) url.searchParams.set(k, v);
    return url.toString();
  }

  async goto(): Promise<this> {
    await this.installCleanState();
    await this.page.goto(this.buildSurveyUrl());
    await this.ready();
    return this;
  }

  async ready(): Promise<void> {
    await waitForVisualStability(this.page);
  }

  text(key: string): string {
    return this.i18n.get(key);
  }
}
