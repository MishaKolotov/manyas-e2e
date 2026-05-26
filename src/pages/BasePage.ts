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
   */
  async installCleanState(): Promise<void> {
    await this.context.clearCookies();
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
