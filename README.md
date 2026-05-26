# Manyas E2E — Walking Survey Localization Tests

End-to-end localization tests for the Walking Survey funnel at https://dev.slimkit.health/walking/survey/?stripeV64=true.

Status: under construction. See `docs/superpowers/specs/2026-05-26-e2e-localization-design.md` for design.

## Setup

```bash
nvm use
npm install
npm run install:browsers
cp .env.example .env
# fill in BASIC_AUTH_USER / BASIC_AUTH_PASS in .env
npm run i18n:import
npm test
```
