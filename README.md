# Manyas E2E — Onboarding Localization Tests

Playwright tests that walk the Walking-Survey **onboarding** (up to the paywall)
across **10 locales × 3 devices × 2 browser engines = 60 projects**, for every
URL-config. They verify translations match the spreadsheet and that text renders
without breaking, and attach a screenshot of every screen to the HTML report for
QA to eyeball.

> Full rationale: [`docs/superpowers/specs/2026-06-15-onboarding-localization-design.md`](docs/superpowers/specs/2026-06-15-onboarding-localization-design.md).
> Step-by-step beginner guide (Russian): [`docs/beginner-guide-ru.md`](docs/beginner-guide-ru.md).

## Quick start

```bash
nvm use                       # Node 20
npm install
npm run install:browsers      # Chromium + WebKit (~500 MB)
cp .env.example .env
# edit .env: BASIC_AUTH_USER=dev, BASIC_AUTH_PASS=gPgFCeJ7
npm run i18n:import           # one-shot: spreadsheet export → JSON
npm run test:smoke            # EN only, fast sanity check
```

## What gets tested

The single spec [`tests/onboarding.spec.ts`](tests/onboarding.spec.ts) drives the
funnel from the first screen until the URL switches to `plan_ready_v2` (the
paywall — **not tested**). On **every** screen it checks:

- **No leaked i18n keys** — no `intro_text_0`-shaped strings or `{{placeholder}}`
  are visible.
- **No layout break** — no horizontal overflow.
- **A screenshot** is attached to the HTML report (open it and eyeball each
  screen for correct, well-fitting translations).

It also does an **exact-match anchor check**: known screen titles (e.g. the
walking-level question) must render with the locale's exact translation from the
spreadsheet. Add anchors by editing `REQUIRED_TITLE_KEYS` / `KNOWN_TITLE_KEYS` in
[`src/pages/OnboardingPage.ts`](src/pages/OnboardingPage.ts).

## Common tasks

| What | Command |
|------|---------|
| Smoke run (EN only, fast) | `npm run test:smoke` |
| Full matrix, all configs | `npm test` |
| One config only | `TEST_CONFIG=taichiwalking npm test` |
| One locale × device × engine | `npx playwright test --project=ru__iphone17pro__webkit` |
| All RU variants | `npx playwright test --project='/ru__.*/'` |
| Headed (watch the browser) | `npm run test:headed` |
| Open the HTML report | `npm run test:report` |
| Re-import translations | `npm run i18n:import` |
| Clean reports/artefacts | `npm run test:clean` |
| Typecheck | `npm run typecheck` |

## URL-configs

All funnel variants live in one file:
[`src/config/configs.ts`](src/config/configs.ts). To add a funnel, add one line
(`{ name, path, params }`). Variant **B** of every A/B test is forced
automatically via `AValue=0&BValue=100` (toggle with `FORCE_B`). Pick which
config(s) run with `TEST_CONFIG=<name>`; unset runs all.

## Project matrix

`{en,fr,it,es,ja,ru,de,pt,zh,ko} × {iphone17pro, iphone16promax, s20} ×
{chromium, webkit}`. Project name: `<locale>__<device>__<engine>`, e.g.
`ru__iphone17pro__webkit`. The locale is set by the **browser** (Playwright's
`locale`/`Accept-Language`), not by URL parameters or an in-app switcher.

## Updating translations

The spreadsheet
([Google Sheet](https://docs.google.com/spreadsheets/d/1Rzp4iq6qcAh7untkPPXRMYjZOvbRLF0tuwoyzPBZsuo))
is the source of truth.

1. Export it as `.xlsx` and replace `WWLI Onboarding Localisation.xlsx` in the repo root.
2. `npm run i18n:import`.
3. `git diff tests/translations/*.json` — verify which strings changed.
4. Run the tests; failures show where the deployed app has not caught up.
5. Commit the xlsx and the JSON together.

## Calibration status

The detect-and-answer driver is calibrated against the live dev funnel, which
has **no `data-testid`s** and serves a **variable funnel** (A/B branching, so the
set and order of screens changes run to run). The driver reliably walks the
first ~20 screens — cover, age, gender, walking level (anchor checked), the
question screens, and the height/current-weight measurement screens — running
the localization checks and attaching a screenshot on every screen. Full early
runs reached the paywall (`default` EN ~1.6 min, RU ~1.9 min) when the funnel
served its shorter variant.

The funnel **tail uses custom widgets** that still need per-widget calibration
in [`OnboardingPage.ts`](src/pages/OnboardingPage.ts): a goal-weight slider, a
results-date scroll-picker (skipped), Likert statement scales (`japanesewalking`),
and image-card "important event" / body-type screens. Extend the handlers and
anchors there one screen at a time — this is the ongoing QA calibration the suite
is built for. Run headed (`npm run test:headed`) to watch where a walk stalls and
add the matching selector/handler.

## Known limitations

- **Playwright WebKit is not iOS Safari.** Snapshots on `webkit + iphone17pro`
  approximate iOS; iOS-only quirks (URL-bar viewport, input zoom, momentum
  scrolling, safe-area insets) are not exercised.
- **Meta in-app browsers (Facebook / Instagram) are out of automation scope** —
  they are native webviews Playwright cannot drive. Test those manually on real
  devices.
- **Device UA strings are approximations** (iPhone 17 Pro is new). They suit
  client-side mobile emulation, not UA-dependent backend branching.
- **Selectors are calibrated against the live dev app** and have no `data-testid`
  to rely on; new screens may need the detect-and-answer selectors extended in
  `OnboardingPage.ts`.
```
