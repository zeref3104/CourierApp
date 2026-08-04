# Tasks: UI Internationalization (i18n-multilang)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,500–2,000 (additions + deletions; ~48 files incl. 3 locale JSONs) |
| 400-line budget risk | High |
| 800-line budget risk | Medium (per-slice targets 350–450; S2 at ~450 is the hot spot) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (S1) → PR 2 (S2) → PR 3 (S3) → PR 4 (S4) |
| Delivery strategy | auto-forecast (chained confirmed; chain type pending) |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**Decision needed before apply**: user must confirm chain type (stacked-to-main vs feature-branch-chain) before sdd-apply starts.

**Recommended slice order**: S1 → S2 → S3 → S4 (each builds on the previous slice's green build; each ends with `tsc -b` green and its own complete translation keys).

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| S1 | i18n infra + shell + settings | PR 1 | base: main (stacked-to-main) or feature/tracker branch if chain type confirmed as feature-branch-chain; keys: `nav.*`, `common.*`, `settings.*`, `status.*` |
| S2 | auth + admin CRUD (16 pages) | PR 2 | depends on S1; keys: `auth.*`, `validation.*`, `companies.*`, `confirm.*`, `customers.*`, `packages.*`, `deliveries.*`, `users.*`, `branches.*` |
| S3 | client panel + dashboard + reports + payment list/form | PR 3 | depends on S2; keys: `dashboard.*`, `reports.*`, `payments.*`, `client.*`, `payment.method.*` |
| S4 | print artifacts + locale alignment + sweep + completeness check | PR 4 | depends on S3; keys: `print.*`, `error.*` |

Each PR: clear start (previous slice's green build), clear finish (`tsc -b` green + completeness), autonomous scope, revertable via `git revert`.

## Phase 1: S1 — i18n Infrastructure & Shell (~400 lines)

- [x] 1.1 **Add deps**: `apps/web/package.json` → add i18next ^26 + react-i18next ^17; run install.
  AC: deps resolve under TS 5.7; no build-config changes. Commit: `chore(web): add i18next and react-i18next`
- [x] 1.2 **i18n core + compile-time gate**: create `src/i18n/languages.ts` (SUPPORTED_LANGUAGES, `setLanguage` validating + writing localStorage `language`, `getActiveLocale`), `src/i18n/i18next.d.ts` (`resources: typeof es.json` — missing key = tsc error), `src/i18n/index.ts` (sync init: `lng = localStorage.language || 'es'`, `fallbackLng: 'es'`, NO browser auto-detect, `document.documentElement.lang` set + `languageChanged` subscription), `src/i18n/locales/{es,en,fr}.json` skeleton for S1 key groups (`es` source; `en`/`fr` cast `typeof es`).
  AC: `tsc -b` green; en/fr typed as `typeof es` (compile gate active). Commit: `feat(i18n): add i18next core with typed es/en/fr resources`
- [x] 1.3 **LanguageSwitcher + SettingsPage**: create `src/components/settings/LanguageSwitcher.tsx` (`<select value={i18n.language}>` → `setLanguage`, `aria-label`); migrate `src/pages/admin/settings/SettingsPage.tsx` hardcoded copy → `settings.*`/`common.*`, add switcher Card (mirrors currency-select styling).
  AC: switching updates UI without reload; choice persists; reload restores. Commit: `feat(i18n): add language switcher and localize settings page`
- [x] 1.4 **Init wiring**: `src/main.tsx` imports `./i18n` before `createRoot`; `index.html` stays `lang="es"` static default; `App.tsx` unchanged.
  AC: first render correct language, no flash; StrictMode-safe. Commit: `feat(i18n): init i18n before app render`
- [x] 1.5 **Shell migration**: `src/components/layout/{Sidebar,Navbar,AuthLayout,AdminLayout,ClientLayout}.tsx`, `src/components/ui/{Badge,Table,CustomerSearchInput}.tsx` (StatusBadge → `t('status.' + slug)`, drop `STATUS_LABELS` usage), `src/components/notifications/NotificationBell.tsx` → `nav.*`/`common.*`/`status.*` incl. aria-labels.
  AC: no hardcoded Spanish in these files (grep-verified); status badges localize. Commit: `feat(i18n): localize shell, nav, and status labels`
- [x] 1.6 **S1 verification**: `tsc -b` green (typed gate proves S1 keys complete in en/fr); manual spot-check switcher persistence (localStorage `language`).
  Commit: none (verification only)
- [x] 1.7 **Pre-existing build fix (approved Option A)**: `apps/web/vite.config.ts` → extend `build.commonjsOptions.include` with `/packages\/(helpers|constants|validation)\//` (keeping the default `/node_modules/`), so rollup converts the CJS workspace packages (`module.exports` at real `packages/*` paths, outside `/node_modules/`) to ESM before bundling.
  AC: `npm run build --workspace @courier/web` green — both `tsc -b` AND `vite build` (previously failed: `"formatCurrency" is not exported by ... @courier/helpers`); S1 i18n code untouched; CJS `require('@courier/helpers')` still works for apps/api (smoke-tested). Commit: `fix(web): bundle CommonJS workspace packages in vite build` (folds into PR 1)

## Phase 2: S2 — Auth + Admin CRUD Pages (~450 lines)

- [x] 2.1 **Auth**: `src/pages/auth/LoginPage.tsx`, `src/pages/auth/ChangePasswordPage.tsx` → `auth.*`, `validation.*` (password hint, min 8 chars, error strings).
  AC: login/password screens fully localize; no Spanish JSX. Commit: `feat(i18n): localize auth pages`
- [x] 2.2 **Companies**: `src/pages/admin/companies/{CompaniesPage,CreateCompanyPage,EditCompanyPage}.tsx` → `companies.*`, `confirm.*` (destructive-confirm dialog via interpolated `t('confirm.deleteCompany', { name })`).
  AC: confirm dialog interpolates company name per language. Commit: `feat(i18n): localize company pages`
- [x] 2.3 **Customers**: `src/pages/admin/customers/{CustomerListPage,CustomerFormPage,CustomerDetailPage}.tsx` → `customers.*`, `common.*` (table headers, form labels, empty states).
  AC: list/form/detail fully localize. Commit: `feat(i18n): localize customer pages`
- [x] 2.4 **Packages**: `src/pages/admin/packages/{PackageListPage,PackageFormPage,PackageDetailPage}.tsx` → `packages.*`; status filter `<option>`s → `status.*` (removes STATUS_LABELS duplication).
  AC: filter options + state history localize. Commit: `feat(i18n): localize package pages`
- [x] 2.5 **Deliveries/Users/Branches**: `src/pages/admin/deliveries/DeliveryListPage.tsx`, `src/pages/admin/users/{UserListPage,UserFormPage}.tsx`, `src/pages/admin/branches/{BranchListPage,BranchFormPage}.tsx` → `deliveries.*`, `users.*`, `branches.*`, `confirm.*` (delivery-complete modal).
  AC: all three modules localize incl. modals/aria. Commit: `feat(i18n): localize delivery, user, and branch pages`
- [x] 2.6 **S2 verification**: `tsc -b` green; typed gate proves every S2 key present in en/fr.
  Commit: none (verification only)

## Phase 3: S3 — Client Panel, Dashboard & Reports (~350 lines)

- [x] 3.1 **Dashboard + payment list/form**: `src/pages/admin/DashboardPage.tsx` → `dashboard.*` (stat cards, "Últimos movimientos", empty state, alerts); `src/pages/admin/payments/{PaymentListPage,PaymentFormPage}.tsx` → `payments.*` (`Pagar {{amount}}` interpolation).
  AC: dashboard stats + payment list/form localize. Commit: `feat(i18n): localize dashboard and payment pages`
- [x] 3.2 **Reports**: `src/pages/admin/reports/ReportsPage.tsx` → `reports.*`; pluralization via `_one`/`_other` ("1 pendiente"/"n pendientes"); replace local `METHOD_LABELS` → `payment.method.*`.
  AC: plural forms correct per language; method labels localized. Commit: `feat(i18n): localize reports with pluralization`
- [x] 3.3 **Client panel**: `src/pages/client/{ClientDashboardPage,MyPackagesPage,PackageDetailPage}.tsx` → `client.*`, `status.*`, `common.*`.
  AC: client-facing pages fully localize. Commit: `feat(i18n): localize client panel`
- [x] 3.4 **S3 verification**: `tsc -b` green; typed gate proves S3 keys complete in en/fr.
  Commit: none (verification only)

## Phase 4: S4 — Print Artifacts, Locale Alignment & Final Sweep (~350–400 lines)

- [x] 4.1 **Locale-aware utils (D1 flag)**: rewrite `src/utils/formatDate.ts` — map `i18n.language` → date-fns locales (`es`→`es`, `en`→`enUS`, `fr`→`fr`) resolved at call time; same 3 exported signatures (12 call sites unchanged); `src/utils/formatCurrency.ts` — **D1 behavior change**: language-bound display, currency-bound symbol (locale `es→es-DO`, `en→en-US`, `fr→fr-FR`, tenant currency passed to `Intl`; USD in Spanish UI renders "US$" — one-line revert if undesired; `@courier/helpers` untouched); create `src/utils/formatNumber.ts`.
  AC: dates/amounts follow active language; `tsc -b` green. Commit: `feat(i18n): make date and currency formatting locale-aware`
- [x] 4.2 **Package label**: `src/utils/packageLabel.ts` — `buildPackageLabelHtml(pkg, companyName?, t = i18n.t)`; all `print.*` keys translated at print time; `<html lang>` from `i18n.language`; localized alert strings.
  AC: label prints fully in es/en/fr. Commit: `feat(i18n): translate package label at print time`
- [x] 4.3 **Receipt + payment detail**: `src/pages/admin/payments/PaymentDetailPage.tsx` — delete `METHOD_LABELS` → `payment.method.*`; `buildReceiptHtml(payment, t)` fed from `useTranslation()`; raw `$`/`toLocaleString('es-DO')` → `formatCurrency`/`formatDateTime`; `status.*` badges; `<html lang>` on receipt.
  AC: receipt amounts locale-formatted; receipt prints in all 3 languages. Commit: `feat(i18n): translate payment receipt at print time`
- [x] 4.4 **Completeness script**: create `scripts/check-i18n.mjs` (deep diff: every flat key in `es.json` exists in `en`/`fr`); add `check:i18n` npm script in `apps/web/package.json`.
  AC: script exits non-zero on missing en/fr key. Commit: `chore(i18n): add translation completeness check`
- [x] 4.5 **Final sweep**: grep `apps/web/src` for residual hardcoded Spanish JSX, `alert()`/`confirm()` strings, aria-labels; remove now-dead `STATUS_LABELS` imports.
  AC: zero hardcoded Spanish UI strings remain (grep-verified). Commit: `refactor(i18n): sweep remaining hardcoded strings`
- [x] 4.6 **S4 verification**: `tsc -b` green; `node scripts/check-i18n.mjs` passes; manual print checks — package label + payment receipt in es, en, fr; language switch + reload persistence re-verified in all 3 languages.
  Commit: none (verification only)
- [x] 4.7 **Adversarial-review fix M1 (typed gate + build wiring)**: correct false "typed gate catches missing keys" claims — the `en as typeof es` / `fr as typeof es` casts are comparability assertions that a SUBSET (missing key) and a SUPERSET (extra key) both satisfy, so tsc catches neither direction (verified by tsc fixture); the typed Resources gate only validates call-site keys against es.json. Wire the real completeness gate into the build: `apps/web/package.json` → `"build": "tsc -b && vite build && node ../../scripts/check-i18n.mjs"` (`check:i18n` kept). Correct claims in `i18next.d.ts`, `i18n/index.ts`, design D6 + Interfaces + Testing Strategy, verify R6 + build evidence.
  AC: `npm run build --workspace @courier/web` runs check-i18n.mjs and exits 0; comments/docs state the gate's real scope. Commit: folds into PR 1 (M1).
