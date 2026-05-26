import { BasePage } from './BasePage';

/**
 * The "landing" of the funnel is a splash screen: a headline, a subtitle,
 * a loader message, and a disclaimer. There is no CTA — the screen auto-
 * transitions to the first survey step after the React bundle hydrates.
 *
 * The headline string is the same English text behind several keys in the
 * xlsx (intro_text_22 / intro_text_25 / result_title_1). We use
 * `intro_text_22` as the canonical reference key.
 */
export class LandingPage extends BasePage {
  get headline() {
    return this.page.getByRole('heading', { name: this.text('intro_text_22'), exact: false }).first();
  }

  get subtitle() {
    return this.page.getByText(this.text('intro_text_23'), { exact: false });
  }

  get loaderText() {
    return this.page.getByText(this.text('intro_text_15'), { exact: false });
  }

  get disclaimer() {
    return this.page.getByText(this.text('intro_text_7'), { exact: false });
  }

  /**
   * Wait until the splash screen has handed off to the first survey step.
   * We detect this by the headline disappearing (the React app unmounts
   * the splash component once the funnel starts).
   */
  async waitForSplashToTransition(timeoutMs = 30_000): Promise<void> {
    await this.headline.waitFor({ state: 'hidden', timeout: timeoutMs });
    // Give the first survey step a moment to paint after the splash hides.
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}
