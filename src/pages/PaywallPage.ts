import { BasePage } from './BasePage';

/**
 * PaywallPage models the final paywall screen. Selectors here are
 * exploratory (the live-app discovery walk timed out before reaching the
 * paywall) — they will be tightened once the survey-flow helper drives the
 * funnel all the way through.
 */
export class PaywallPage extends BasePage {
  get heading() {
    // Use Playwright's :visible engine because the paywall mounts several
    // hidden h2 nodes (cached for fast scroll transitions). We want the
    // currently-rendered one.
    return this.page.locator('#root h1:visible, #root h2:visible').first();
  }

  get priceBlock() {
    // Anything that looks like a price string. Picking the first match is
    // intentional: paywalls usually highlight a single headline price.
    return this.page
      .locator('#root *')
      .filter({ hasText: /[$€£¥]\s?\d|\d+[.,]\d{2}\s?[$€£¥]/ })
      .first();
  }

  get cta() {
    return this.page
      .getByRole('button', { name: /pay|subscribe|start|continue|get plan|оплатить|купить/i })
      .filter({ visible: true })
      .first();
  }

  get stripeIframe() {
    return this.page.locator('iframe[src*="stripe"]').first();
  }
}
