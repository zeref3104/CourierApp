# Proposal: UI Internationalization (i18n-multilang)

## Intent

Multilingual SaaS, but 100% of `apps/web` UI copy is hardcoded Spanish (~500–600 strings, 43 files). Add English + French with a Settings-page selector; Spanish stays default. UI-only.

## Scope

### In Scope
- i18next + react-i18next init (bundled JSON; no build-config changes)
- `es/en/fr.json` resources (~500–600 keys; `es` = source of truth)
- `LanguageSwitcher` on SettingsPage; localStorage `language`; Spanish fallback; `document.documentElement.lang` sync
- Migrate all hardcoded copy (43 files: pages, layouts, ui components, utils, print builders)
- Locale-aware dates: `formatDate` maps `i18n.language` → date-fns locales
- Print artifacts translated at print time; receipt aligned to `formatCurrency`
- Pluralization ("1 pendiente"/"n pendientes") via `_one`/`_other`

### Out of Scope
- Backend, email templates; `@courier/constants` internals (`STATUS_LABELS` translated at UI layer via `status.*` keys)
- Auto-detection and Navbar selector (deferred)
- French quality: machine-grade v1; human review later

## Capabilities

### New Capabilities
- `ui-i18n`: i18n infrastructure, es/en/fr resources, switcher, locale-aware dates/currency, translated print artifacts.

### Modified Capabilities
- None — no spec-level requirement changes.

## Approach

1. `i18n/index.ts`: `fallbackLng: 'es'`, flat namespace grouped (`nav.*`, `status.*`, `payment.method.*`, `common.*`); `languageChanged` → `document.lang` + locale cache.
2. `StatusBadge` → `t('status.' + slug)`; `METHOD_LABELS` duplicates → `t('payment.method.*')`.
3. `LanguageSwitcher` mirrors currency-select pattern; reads/writes localStorage `language`; kept out of Redux.
4. `formatDate.ts` rewritten with `language → locale` map; call sites unchanged.
5. Print builders call `i18n.t()` at print time; receipt's raw amounts → `formatCurrency`.
6. **Chained PR slices** (800-line budget; forecast ~1,500–2,000 lines, 48 files):
   - S1: infra + init + switcher + SettingsPage + shell + status (~400)
   - S2: auth + admin CRUD pages (~450)
   - S3: client portal + dashboards + reports/pluralization (~350)
   - S4: print artifacts + formatDate/currency alignment + final sweep + completeness check (~350)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/i18n/*` | New | Init, locales, switcher |
| `main.tsx`, `App.tsx`, `index.html` | Modified | Init import, `lang` sync |
| `pages/admin/settings/SettingsPage.tsx` | Modified | Switcher home |
| `utils/{formatDate,formatCurrency}.ts` | Modified | Locale-aware |
| `utils/packageLabel.ts`, `PaymentDetailPage.tsx` | Modified | Print translation |
| `components/{layout,ui,notifications}/**` | Modified | Shell/status labels |
| `pages/**` (~27 files) | Modified | Copy → `t()` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Print regressions surface only at print time | Medium | Manual print verification; `i18n.t()` at call time |
| Key drift across JSONs | Medium | Typed `Resources` + CI completeness check |
| Date locale missed → Spanish dates | Medium | Single locale map + `languageChanged` hook |
| Budget overrun vs 800 lines | High | Chained slices, independently revertable |
| `alert()`/aria strings missed | Low | Inventory as checklist |

## Rollback Plan

UI-only — no DB/config change. Revert per-slice via `git revert`/`checkout`; slices independent. Persistence isolated in localStorage `language` (no server state).

## Dependencies

- i18next ^26 + react-i18next ^17 (TS 5.7-compatible; no build changes)
- date-fns locales: `es` present; add `enUS`/`fr`

## Success Criteria

- [ ] UI renders in all 3 languages; selector persists; default `es`
- [ ] No hardcoded Spanish JSX text remains (grep-verified)
- [ ] Dates, currency, print artifacts follow selected locale
- [ ] `tsc -b` passes; print artifacts correct in all 3 languages

## Open Decisions (design phase)

- Receipt formatting: currency-bound vs language-bound
- Language in Redux vs out
- Static vs lazy `import()` of locale JSONs
