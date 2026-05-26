# Manyas E2E — Walking Survey Localization Tests

End-to-end localization tests for the Walking Survey funnel at
[dev.slimkit.health](https://dev.slimkit.health/walking/survey/?stripeV64=true).
The matrix is 10 locales × 3 devices × 2 browser engines = **60 Playwright projects**.

## Quick start

```bash
nvm use                       # Node 20
npm install
npm run install:browsers      # Chromium + WebKit (~500 MB)
cp .env.example .env
# edit .env: set BASIC_AUTH_USER=dev and BASIC_AUTH_PASS=gPgFCeJ7
npm run i18n:import           # one-shot xlsx → JSON
npm test                      # full matrix (~45 min)
```

The first run will take longer because Playwright downloads its browser
bundles and the importer parses the 5 MB localization spreadsheet.

## Common tasks

| What                                                 | Command                                                |
|------------------------------------------------------|--------------------------------------------------------|
| Smoke run (EN only, fast)                            | `npm run test:smoke`                                   |
| Single locale × device × engine                      | `npx playwright test --project=ru__iphone17__webkit`   |
| All RU variants                                      | `npx playwright test --project='/ru__.*/'`             |
| One spec, headed                                     | `npm run test:headed -- tests/localization/landing.spec.ts` |
| Open HTML report                                     | `npm run test:report`                                  |
| Update visual baselines after intentional UI changes | `npm run test:update-snapshots`                        |
| Re-import translations after new xlsx                | `npm run i18n:import`                                  |
| Verify fixtures are in sync with xlsx                | `npm run i18n:check`                                   |
| Clean reports and per-test artefacts                 | `npm run test:clean`                                   |
| Lint / typecheck / format                            | `npm run lint` / `npm run typecheck` / `npm run format` |

## Project matrix

60 Playwright projects: every combination of
`{en,fr,it,es,ja,ru,de,pt,zh,ko} × {iphone17, iphone16promax, s20e} ×
{chromium, webkit}`. Naming: `<locale>__<device>__<engine>`.

## What gets tested

| Spec                                  | Asserts                                                         |
|---------------------------------------|-----------------------------------------------------------------|
| `tests/localization/landing.spec.ts`  | The splash renders localized headline + subtitle + loader + disclaimer for the project's locale; no horizontal overflow. |
| `tests/localization/survey-flow.spec.ts` | The funnel walks from splash to paywall using detect-and-answer, exercising the full localized survey.               |
| `tests/localization/paywall.spec.ts`  | Paywall heading + CTA + locale-formatted price are present.    |
| `tests/localization/no-missing-keys.spec.ts` | No leaked i18n keys (`intro_text_0`-shaped strings) or `{{template}}` placeholders are visible at any step.    |
| `tests/localization/visual.spec.ts`   | Pixel snapshots of landing, first survey step, and paywall.    |

## Important constraints

- **Locale is set by the browser**, not URL parameters or in-app language switchers.
  Tests verify that the funnel honors `navigator.language` / `Accept-Language`.
- **Playwright WebKit is NOT iOS Safari.** Snapshots on `webkit + iphone17` are an
  approximation; iOS-only quirks (viewport-unit URL bar behaviour, input zoom,
  momentum scrolling, safe-area insets) are not exercised. Real-device testing
  remains out of scope.
- **xlsx is the frozen source of truth for translations.** A diff between xlsx
  and live app is a bug, not a test infrastructure problem.

## Snapshot scope

Following spec §8.3 (in `docs/superpowers/specs/2026-05-26-e2e-localization-design.md`):

- Landing: EN × 3 devices × 2 engines + 9 non-EN locales × iPhone 17 × 2 engines = 24 PNG.
- First survey step: EN only × 3 devices × 2 engines = 6 PNG.
- Paywall: same shape as landing = 24 PNG.
- Total ~54 baselines.

The non-EN device coverage is intentionally narrowed to iPhone 17 so a copy
change for a single locale ends up touching at most 2 PNGs, not 6.

## Updating translations

1. Replace `WWLI Onboarding Localisation.xlsx` in the repo root.
2. `npm run i18n:import`.
3. `git diff tests/fixtures/i18n/*.json` — verify which strings changed.
4. Run the test suite; failures highlight where the deployed app has not
   caught up to the new copy.
5. Commit the xlsx and the JSON fixtures together.

## Project layout

```
src/
  config/             Locales, devices, projects matrix, env loader
  fixtures/           Playwright i18n fixture (injects translations per project)
  pages/              Page Object Model (Base / Landing / Survey / Paywall)
  utils/              xlsx importer, i18n loader / check, visual helpers, wait-stable
tests/
  config/             Unit tests for the configs above
  utils/              Unit tests for the importer + i18n-check + i18n-loader
  fixtures/i18n/      Per-locale JSON files generated from xlsx (committed)
  helpers/            Survey-flow detect-and-answer driver
  localization/       The five spec files listed earlier
docs/
  superpowers/
    specs/            Design specification
    plans/            Step-by-step implementation plan
    notes/            Discovery notes from the live-app walk
  guides/             Russian-language onboarding guide for beginners
```

## Status snapshot (2026-05-26)

What is **verified end-to-end** against the live dev stand:

- All five spec files run against `en__iphone17__chromium`.
  `landing.spec.ts`, `survey-flow.spec.ts`, and `paywall.spec.ts` pass.
- `landing.spec.ts` additionally verified on `ru`, `de`, `ja`, `zh`
  (`iphone17 × chromium`).
- The 60-project matrix materialises correctly: `npx playwright test --list`
  reports 60 unique project ids.
- The importer produces 11 fixture files (10 locales + `_meta.json`) from
  the live xlsx; 1328 keys imported, 98 cross-sheet duplicates logged, 83
  rows skipped (markers / emoji / Russian-internal notes).

What still needs **hand-finishing** (known limitations):

- `survey-flow.spec.ts` / `paywall.spec.ts` / `no-missing-keys.spec.ts`
  / `visual.spec.ts` have been verified on EN but not yet on the full
  matrix. The survey-flow detect-and-answer helper is locale-sensitive in a
  few places (e.g. the input-validation messages that drive height/weight
  defaults are EN strings). Expect to tune `SurveyPage` heading regexes for
  RU/DE/JA/ZH/KO when the cross-locale run finds the next surprise.
- Visual baselines (`*-snapshots/` folders) are not yet generated. Run
  `npm run test:update-snapshots` from a known-good build to produce them,
  then commit the PNGs.
- Three open spec items from §12 are not yet closed:
  1. **pt-PT vs pt-BR** — locale config currently uses `pt-PT`; verify
     against the live `Accept-Language: pt-BR` response and update
     `src/config/locales.ts` if the app actually serves Brazilian
     Portuguese.
  2. **UA-smoke** — compare server responses for our iPhone 17 UA stub
     vs a real iOS UA and document the result.
  3. **MAX_STEPS calibration** — `tests/helpers/survey-flow.ts` currently
     defaults to 120. Run a clean walk and tighten to `ceil(observed × 1.5)`.

See `docs/superpowers/specs/2026-05-26-e2e-localization-design.md` for the
full design rationale and `docs/superpowers/plans/2026-05-26-e2e-localization-plan.md`
for the original implementation plan. The Russian-language beginner guide is
at `docs/guides/playwright-beginner-guide-ru.md`.
