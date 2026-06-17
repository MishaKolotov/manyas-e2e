import type { Page, BrowserContext } from '@playwright/test';
import type { UrlConfig } from '../config/configs';
import { buildConfigUrl } from '../config/configs';

export class BasePage {
  constructor(
    protected readonly page: Page,
    protected readonly context: BrowserContext,
    protected readonly baseUrl: string,
  ) {}

  /** Clear funnel progress (localStorage/sessionStorage) before any page script runs. */
  async installCleanState(): Promise<void> {
    await this.context.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* storage may be unavailable on about:blank */
      }
    });
    await this.context.clearCookies();
  }

  /** Navigate to the given config's onboarding entry URL (variant B forced). */
  async goto(config: UrlConfig): Promise<void> {
    await this.installCleanState();
    await this.page.goto(buildConfigUrl(config, this.baseUrl), { waitUntil: 'domcontentloaded' });
  }
}
