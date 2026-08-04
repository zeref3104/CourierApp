# Project Conventions — courier

Scope: Courier SaaS Platform monorepo (`courierapp`). Applies to every SDD phase and any code change in this project.

## i18n: 3-Language Support (MANDATORY)

**Anything we add or modify that surfaces to the user MUST be supported in all 3 languages: es, en, fr.**

### Rules

1. **Every new or changed user-facing string** (UI copy, labels, buttons, titles, messages, errors, placeholders, accessibility text, print artifacts) MUST have a translation key present in ALL three locale files:
   - `apps/web/src/i18n/locales/es.json`
   - `apps/web/src/i18n/locales/en.json`
   - `apps/web/src/i18n/locales/fr.json`
2. **No hardcoded UI copy** in components/pages — always resolve through `t('...')` (react-i18next). The i18n sweep already removed hardcoded strings; do not regress.
3. **Interpolation params MUST be aligned** across the 3 files (e.g. `{{tracking}}` present in es/en/fr with the same shape).
4. **Status labels** resolve via `status.{slug}` at the UI layer. Do NOT modify `@courier/constants` internals (the API consumes them via `require()`).
5. **Payment methods / enums** label via `payment.method.*` keys; never hardcode slugs in components.
6. **Enforcement gate**: `scripts/check-i18n.mjs` runs in the web build (`npm run build`) and FAILS on missing/extra keys or misaligned interpolation. A change is NOT complete until this gate passes.
7. **Print artifacts** (receipts, package labels) translate at print time via `t()`. User-derived values must be escaped (see `apps/web/src/utils/escapeHtml.ts`); keys live in all 3 locales.

### SDD integration

- `sdd-spec` MUST include i18n requirements in delta specs for any UI-visible change.
- `sdd-tasks` MUST include a task for adding/updating the 3 locale files when the change touches UI.
- `sdd-apply` MUST add/update keys in all 3 files in the same work unit as the code that uses them (never leave a key missing in one language).
- `sdd-verify` MUST run the web build (or the i18n gate) and report the `check-i18n.mjs` result.
