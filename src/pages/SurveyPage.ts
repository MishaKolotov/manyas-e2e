import { BasePage } from './BasePage';

export type QuestionType = 'choice' | 'likert' | 'slider' | 'number' | 'text' | 'info';

/**
 * SurveyPage encapsulates the in-funnel steps that come after the splash
 * and before the paywall. Each step is one of:
 * - choice: option buttons carrying `[data-value]` (single- or multi-choice)
 * - slider: `<input type="range">`
 * - number/text input: `<input type="number">` or plain text input
 * - info slide: no inputs, just a Continue button
 */
export class SurveyPage extends BasePage {
  /**
   * Scope all live-app locators to `#root` so OneTrust's hidden inputs don't
   * confuse the detector.
   */
  get rootScope() {
    return this.page.locator('#root');
  }

  get options() {
    // Card buttons with explicit data-value — age, gender, fitness level,
    // diet, allergies, day-shape, walking-time, walking-frequency, etc.
    return this.rootScope.locator('[data-value]');
  }

  /**
   * Fallback option buttons for screens that use bare <button>label</button>
   * cards without [data-value] — e.g. the "When do you prefer to do walking
   * exercises?" modal popup that floats over the "calculating water intake"
   * loader. We match plain buttons inside #root whose text looks like an
   * answer label: 2 to 40 characters, no navigation/control verbs.
   */
  get modalOptionButtons() {
    return this.rootScope.locator('button').filter({
      hasText:
        /^(?!(continue|next|done|got it|skip|cancel|close|back|prev)\b)[^\n]{2,40}$/i,
    });
  }

  get likertButtons() {
    // Likert / rating buttons (1..5) on "Do you relate to …" statements have
    // no data attributes — they are plain <button>N</button> elements with a
    // numeric text node. We match by content + structure.
    return this.rootScope
      .locator('button')
      .filter({ hasText: /^\s*\d\s*$/ });
  }

  get slider() {
    return this.rootScope.locator('input[type="range"]').first();
  }

  get numberInput() {
    return this.rootScope.locator('input[type="number"]:visible').first();
  }

  get textInput() {
    return this.rootScope
      .locator(
        'input[type="text"]:visible, input[type="email"]:visible, input:not([type]):visible',
      )
      .first();
  }

  get continueButton() {
    // Primary advance button inside the React root. The live bundle uses a
    // handful of short imperatives across screens: continue / next / done /
    // got it / let's go / get started / submit / go / sure (newsletter
    // opt-in: "Sure, I'm in!").
    return this.page
      .locator('#root button', {
        hasText:
          /^(continue|next|done|got it|let.?s (go|start)|get started|submit|go|sure\b)/i,
      })
      .first();
  }

  /**
   * "Skip this question" fallback. Surveys sometimes show a scroll-wheel
   * date picker or a similar control whose default value the validator
   * doesn't accept. When the primary Continue button is disabled and a
   * skip link is visible, use it.
   */
  get skipQuestionLink() {
    return this.page
      .locator('#root', { hasNotText: 'Cookie' })
      .getByText(/skip(\s+this(\s+question)?)?/i)
      .first();
  }

  async detectQuestionType(): Promise<QuestionType> {
    if ((await this.options.count()) > 0) return 'choice';
    if ((await this.likertButtons.count()) >= 2) return 'likert';
    if (await this.slider.isVisible().catch(() => false)) return 'slider';
    if (await this.numberInput.isVisible().catch(() => false)) return 'number';
    if (await this.textInput.isVisible().catch(() => false)) return 'text';
    return 'info';
  }

  /**
   * Pick the first valid answer on the current step (whatever its shape).
   * For info screens this is a no-op — call `advance()` to move on.
   */
  async answerCurrentStep(): Promise<QuestionType> {
    const type = await this.detectQuestionType();
    switch (type) {
      case 'choice': {
        await this.options.first().click();
        // Some screens auto-advance after a click; others wait for Continue.
        break;
      }
      case 'likert': {
        // Pick the middle value (3 of 5) — a moderate answer that doesn't
        // skew the funnel toward edge-case branches.
        const buttons = await this.likertButtons.all();
        const mid = buttons[Math.floor(buttons.length / 2)] ?? buttons[0];
        await mid.click();
        break;
      }
      case 'slider': {
        await this.slider.focus();
        for (let i = 0; i < 3; i++) await this.page.keyboard.press('ArrowRight');
        break;
      }
      case 'number': {
        await this.numberInput.fill('30');
        break;
      }
      case 'text': {
        // Several "text" inputs are inputmode="numeric" wearing a text
        // disguise — height (ft/in or cm), weight (lb/kg), age, goal weight.
        // Pick a realistic value per unit so the form's validators don't
        // block the Continue/Done button. Goal weight specifically must be
        // *less* than current weight to clear that screen's validator.
        const all = await this.rootScope
          .locator(
            'input[type="text"]:visible, input[type="email"]:visible, input:not([type]):visible',
          )
          .all();
        const heading = (await this.rootScope.locator('h1, h2').first().textContent()) ?? '';
        const isHeight = /height/i.test(heading);
        const isGoalWeight = /goal\s*weight|target\s*weight/i.test(heading);
        const isWeight = /weight/i.test(heading) && !isGoalWeight;
        const isAge = /\bage\b/i.test(heading);
        const isEmail = /email|personalized|weight loss plan/i.test(heading);

        for (let i = 0; i < all.length; i++) {
          const input = all[i];
          const type = (await input.getAttribute('type')) ?? '';
          const aria = (await input.getAttribute('aria-label')) ?? '';
          const placeholder = (await input.getAttribute('placeholder')) ?? '';
          const hint = `${type} ${aria} ${placeholder}`.toLowerCase();
          let value = 'Test';
          if (type === 'email' || /email/i.test(hint) || isEmail) {
            value = 'manyas-e2e@example.test';
          } else if (isHeight) {
            // ft → 5, in → 8, cm → 170
            if (/cm/i.test(hint)) value = '170';
            else if (/in/i.test(hint)) value = '8';
            else value = '5';
          } else if (isGoalWeight) {
            // Stay below the current-weight value we used (150 lb / 70 kg).
            value = /kg/i.test(hint) ? '65' : '140';
          } else if (isWeight) {
            value = /kg/i.test(hint) ? '70' : '150';
          } else if (isAge) {
            value = '30';
          } else if (/(height|weight|age|cm|kg|ft|in|lb)/i.test(hint)) {
            value = '5';
          }
          await input.fill(value).catch(() => undefined);
        }
        break;
      }
      case 'info':
        // No input to provide — the only action is Continue.
        break;
    }
    return type;
  }

  /**
   * Click the primary advance control: Continue/Next button first, then
   * Skip-this-question link, then any "bare" option button (modal popups
   * use plain <button>label</button> without data-value). Returns true if
   * something was clicked.
   */
  async advance(): Promise<boolean> {
    const btn = this.continueButton;
    if (await btn.isVisible().catch(() => false)) {
      if (await btn.isEnabled().catch(() => false)) {
        await btn.click().catch(() => undefined);
        return true;
      }
    }
    const skip = this.skipQuestionLink;
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => undefined);
      return true;
    }
    // Last-resort: a modal popup may render bare <button> options without
    // data-value or aria-pressed. Pick the first label-shaped button.
    if ((await this.modalOptionButtons.count()) > 0) {
      await this.modalOptionButtons.first().click().catch(() => undefined);
      return true;
    }
    return false;
  }

  /**
   * Paywall detection — multiple independent signals OR'd together because we
   * don't yet know which one stays stable. Returns true once any of them
   * trip.
   */
  async isPaywallVisible(): Promise<boolean> {
    return this.page.evaluate(() => {
      const stripeIframe = !!document.querySelector('iframe[src*="stripe"]');
      const stripeForm = !!document.querySelector(
        'form[action*="stripe"], [class*="StripeElement"]',
      );
      const dataAttr = !!document.querySelector('[data-testid*="paywall" i], [class*="paywall" i]');
      const priceText = Array.from(document.querySelectorAll('*')).some((el) => {
        const t = (el.textContent ?? '').trim();
        return (
          t.length > 0 &&
          t.length < 40 &&
          (/^[$€£¥]\s?\d/.test(t) || /\d+[.,]\d{2}\s?[$€£¥]/.test(t))
        );
      });
      return stripeIframe || stripeForm || dataAttr || priceText;
    });
  }
}
