import { BasePage } from './BasePage';

export type QuestionType = 'choice' | 'likert' | 'slider' | 'number' | 'text' | 'info';

/**
 * Localized "advance" button labels across the 10 supported locales,
 * extracted from the xlsx translations of Continue / Next / Done / Got it
 * plus the English newsletter opt-in ("Sure, I'm in!"). Anchored at the
 * start so it doesn't match longer sentences that merely contain the word.
 */
const CONTINUE_LABELS = [
  // en
  'continue',
  'next',
  'done',
  'got it',
  "let's go",
  'lets go',
  "let's start",
  'get started',
  'submit',
  'go',
  'sure',
  // ru
  'далее',
  'продолжить',
  'готово',
  'понял',
  'хорошо',
  'ок',
  // de
  'weiter',
  'fortsetzen',
  'fertig',
  'verstanden',
  'alles klar',
  // fr
  'continuer',
  'suivant',
  'fait',
  "j'ai compris",
  // es
  'continuar',
  'siguiente',
  'listo',
  'entendido',
  'entiendo',
  'lo tengo',
  // it
  'continua',
  'avanti',
  'fatto',
  'capito',
  'va bene',
  // pt
  'próximo',
  'proximo',
  'pronto',
  'entendi',
  'percebi',
  // ja
  '続ける',
  '次へ',
  '完了',
  '了解',
  'わかりました',
  // zh
  '继续',
  '下一步',
  '完成',
  '了解',
  '明白',
  // ko
  '계속',
  '다음',
  '완료',
  '알겠습니다',
];

const CONTINUE_LABEL_RE = new RegExp(
  '^\\s*(' + CONTINUE_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')',
  'i',
);

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
    // Primary advance button inside the React root. The label is localized,
    // so this regex unions the continue/next/done/got-it forms across all 10
    // supported locales (extracted from the xlsx fixtures). Without the
    // localized words the funnel got stuck on choice screens whose only
    // advance control is a bottom "Continue"-equivalent button (e.g. RU
    // "Далее", DE "Weiter", JA "次へ").
    return this.page.locator('#root button', { hasText: CONTINUE_LABEL_RE }).first();
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
        await this.fillTextStep();
        break;
      }
      case 'info':
        // No input to provide — the only action is Continue.
        break;
    }
    return type;
  }

  /**
   * Fill a text/number input step. The screen kind (height / current weight
   * / goal weight / age / email) is detected by matching the heading against
   * the localized i18n value for that screen's title key — so it works in
   * every locale, not just English. Inputs are then filled positionally with
   * values that satisfy the form's validators under the default unit system
   * (imperial): height = 5 ft 8 in, weight = 150 lb, goal weight = 140 lb
   * (must stay below current weight), age = 30.
   */
  private async fillTextStep(): Promise<void> {
    const inputs = await this.rootScope
      .locator(
        'input[type="text"]:visible, input[type="email"]:visible, input[type="number"]:visible, input:not([type]):visible',
      )
      .all();
    if (inputs.length === 0) return;

    const heading = (await this.rootScope.locator('h1, h2').first().textContent())?.trim() ?? '';
    const matches = (key: string) => {
      if (!this.i18n.has(key)) return false;
      const expected = this.i18n.get(key).replace(/\s+/g, ' ').trim().toLowerCase();
      return expected.length > 0 && heading.replace(/\s+/g, ' ').toLowerCase().includes(expected);
    };

    const isHeight = matches('height_title');
    const isGoalWeight = matches('goalWeight_title');
    const isCurrentWeight = matches('currentWeight_title') && !isGoalWeight;

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = (await input.getAttribute('type')) ?? '';
      const hint = `${type} ${(await input.getAttribute('aria-label')) ?? ''} ${
        (await input.getAttribute('placeholder')) ?? ''
      }`.toLowerCase();

      let value = '30'; // sensible numeric default (age etc.)
      if (type === 'email' || /email|@/.test(hint)) {
        value = 'manyas-e2e@example.test';
      } else if (isHeight) {
        // First field = ft (or cm), second = in. 5 ft 8 in is valid imperial;
        // if the default tab is metric, "5" then "8" still parses as cm-ish
        // and the form re-validates — we rely on the imperial default that
        // the live app ships with.
        value = i === 0 ? '5' : '8';
      } else if (isGoalWeight) {
        value = '140'; // below the 150 current weight we enter
      } else if (isCurrentWeight) {
        value = '150';
      }
      await input.fill(value).catch(() => undefined);
    }
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
