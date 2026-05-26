# Survey-flow discovery notes — 2026-05-26

Recorded by an automated exploration spec (`tests/manual-explore.spec.ts`, since
deleted) that walked the live app at
`https://dev.slimkit.health/walking/survey/?stripeV64=true` and logged every
intermediate DOM shape. Confirmed in headless Chromium with the
`en__iphone17__chromium` Playwright project.

## Cookie banner

OneTrust cookie banner is permanently present in the DOM (`#onetrust-pc-sdk`)
but does not occlude the survey body. We **suppress the banner UI** by
pre-seeding the `OptanonAlertBoxClosed` cookie before navigation:

```ts
await context.addCookies([
  { name: 'OptanonAlertBoxClosed', value: new Date().toISOString(),
    domain: 'dev.slimkit.health', path: '/' },
]);
```

After that the banner's interactive surface (Accept/Settings buttons) goes
away; the underlying DOM still has the OneTrust headings, but they are not
visible to the user and don't interfere with `data-value` clicks.

## Splash → first step

The first screen is a splash, not a landing in the "with a CTA button" sense.

- `<h1>` text: `Discover how quickly you can reach your weight loss goals through Walking`
  - matching xlsx keys: `intro_text_22`, `intro_text_25`, `intro_text_28`,
    `result_title_1` (all carry the same English string)
- subtitle: `New You in 12 weeks` (`intro_text_23` / `result_subtitle_1`)
- loader: `Loading the quiz` (`intro_text_15` / `result_loader_text`)
- disclaimer: `Results vary depending on your starting point, goals and effort.`
  (`intro_text_7` / `result_description_1`)

After ~3–5 seconds the splash hides itself and the first survey step appears.
There is no CTA on the splash; the transition is purely time/network driven.

**LandingPage POM implication:** the landing has no clickable target. The
landing test asserts the headline + subtitle render in the current locale,
then waits for the splash to hide (`heading` matching the i18n value of the
splash key disappears).

## Survey option DOM

Choice buttons (single-choice & multi-choice) are all rendered as:

```html
<button class="sc-fNOGik eqLpvg"
        data-value="30-39"
        aria-pressed="false"
        role="button"
        tabindex="0">…</button>
```

Stable selector: `#root [data-value]`. The class names are
styled-components hashes and will change between deploys; do not use them.

The `aria-pressed` attribute toggles on selection. After a click some screens
auto-advance, others require a separate `Continue` button.

## Survey heading sequence (observed)

Walking the survey by always picking the first `[data-value]` option:

| Step | Heading                                                                                 | Inputs                | Notes |
|------|-----------------------------------------------------------------------------------------|-----------------------|-------|
| 1    | `Walking workouts` (section header) / `Tailored to your age group`                       | 4 options (`30-39`, `40-49`, `50-59`, `60+`) | Auto-advance after click |
| 2    | `Let's personalize your Walking plan to fit your body and lifestyle`                     | 2 options (gender)    | Auto-advance |
| 3    | `27 million users have chosen Walking by Slimkit`                                        | none — info slide     | Needs Continue |
| 4    | `What's your current walking level?`                                                     | 3 options             | Auto-advance |
| 5    | `How often would you like to walk?`                                                      | 4 options             | Auto-advance |
| 6    | `How much time would you like to spend on workouts?`                                     | 4 options             | Auto-advance |
| 7    | `Please, describe your typical day`                                                      | 4 options             | Auto-advance |
| 8    | `Choose your diet type`                                                                  | 4 options             | Auto-advance |
| 9    | `Do you experience any allergies?`                                                       | 4 options             | Auto-advance |
| 10–?  | `Without vs With Walking app` (multiple consecutive info slides — observed 12 of them in a row before timeout) | none — info slides | Needs Continue (chart visualisation, "Walking gives you long-term results …") |

The first nine real-question steps were reached cleanly. The "Without vs With"
info block has multiple slides chained together; each one needs an explicit
Continue button. Beyond that the exploration timed out before reaching the
paywall.

## Implication for `survey-flow.ts` helper

`completeAllSteps` should:

1. Recognise three screen shapes:
   - **Choice screen**: `#root [data-value]` count > 0 → click first option →
     wait for `[aria-pressed="true"]` on it → wait briefly → if a Continue
     button is now visible, click it.
   - **Slider screen**: `#root input[type="range"]` present → focus + arrow
     right ×3 → Continue.
   - **Input screen**: `#root input[type="number"]:visible` (or `text`) →
     fill sensible value → Continue.
   - **Info slide**: none of the above → click Continue alone.
2. Treat the "Continue" button as a primary advance lever — its locator is
   `getByRole('button', { name: /^(continue|next|let.?s (go|start)|get started)$/i }).first()`
   and it must be found inside `#root` to avoid OneTrust noise.
3. Detect paywall by: `iframe[src*="stripe"]`, `[class*="StripeElement"]`,
   `form[action*="stripe"]`, or visible price text matching `/^[$€£¥]/`.
4. Safety cap: based on observed prefix (9 question steps + ≥12 info slides
   already + unknown paywall distance) → set `MAX_STEPS = 60` as a defensive
   margin until a clean full walk gives a precise figure.

## Open issues / follow-ups

- The "Without vs With" info-slide block timed out in the exploration spec —
  the Continue button was rendered (confirmed in the failure screenshot) but
  our `.click()` raced the OneTrust banner overlay during initial paint. The
  production survey-flow helper needs a small `waitFor({ state: 'attached' })`
  on the Continue button before clicking, and a retry on click failure.
- Paywall structure is not yet captured. Once the helper passes the info
  block, log the paywall DOM there and update Task 17 (paywall.spec.ts) with
  concrete selectors. For now the paywall locators in PaywallPage are based on
  the Stripe-iframe signal, which is generic enough to work for a first pass.
- The splash → survey transition timing is environment-dependent (loading the
  React bundle + initial API call). 30s waitForHidden on the splash heading
  has comfortably been enough in practice.
