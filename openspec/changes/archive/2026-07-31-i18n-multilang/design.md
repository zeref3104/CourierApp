# Design: UI Internationalization (i18n-multilang)

## Technical Approach

i18next ^26 + react-i18next ^17 in `apps/web`, statically bundled `es/en/fr` JSON, single flat `translation` namespace, localStorage key `language`, Spanish default. Settings-page LanguageSwitcher writes via `setLanguage()`. `formatDate`/`formatCurrency` become locale-aware; print builders translate at print time via injectable `t`. Four chained PR slices, each compile-green and revertable.

## Architecture Decisions

| # | Decision | Choice | Alternatives | Rationale |
|---|----------|--------|--------------|-----------|
| D1 | Receipt/currency | **Language-bound display, currency-bound symbol**: web `formatCurrency(amount, currency?)` derives locale from `i18n.language` (`es→es-DO`, `en→en-US`, `fr→fr-FR`), passes tenant currency to `Intl`. `@courier/helpers` untouched (API shares it) | Helpers' fixed currency→locale map | Spec R4: amounts follow selected locale; receipt reuses wrapper. USD-in-es → "US$" (correct for DR); one-line revert if undesired |
| D2 | Language in Redux | **No** — i18next is the single source of truth; `useTranslation()` re-renders; utils read `i18n.language` | Mirror `theme` in `uiSlice` | Dual source of truth + sync for zero benefit |
| D3 | Static vs lazy | **Static bundled JSON**, top-level imports | `resourcesToBackend` + dynamic `import()` | ~30–40 KB/lang gzip'd; sync init, no flash; JSON imports verified under current tsconfig |
| D4 | Init wiring | `main.tsx` imports `./i18n` before `createRoot`; module side-effect: sync `init({ lng: localStorage.language || 'es', fallbackLng: 'es' })`, validate vs `SUPPORTED_LANGUAGES`, set `document.documentElement.lang`, subscribe `languageChanged`. `index.html lang="es"` stays; **App.tsx unchanged** | Init in App component | No flash (first render correct); StrictMode-safe (module scope) |
| D5 | Date locale | Rewrite `formatDate.ts`: `{ es, en: enUS, fr }` from `date-fns/locale`, resolved at call time from `i18n.language`; same 3 exported signatures → 12 call sites unchanged | Cache locale on `languageChanged` | Trivial lookup, always correct, no invalidation edges |
| D6 | Key org | Single namespace; groups: `common`, `nav`, `auth`, `validation`, `status.*` (10 slugs), `payment.method`, `dashboard`, `reports`, `settings`, `payments`, `packages`, `clients`, `deliveries`, `users`, `branches`, `companies`, `error`, `confirm`, `print` (label.*/receipt.*). Plurals `_one`/`_other`. **Completeness**: typed Resources give call-site key validation against es.json only (`t('key')` errors on keys absent from es). The `en as typeof es` / `fr as typeof es` casts do NOT enforce en/fr completeness — a SUBSET (missing key) and a SUPERSET (extra key) both satisfy the comparability assertion (verified by tsc fixture, 2026-07-31), so neither missing nor extra keys fail tsc. The real completeness gate is `scripts/check-i18n.mjs` (missing + extra + interpolation parity), wired into the web build: `build` = `tsc -b && vite build && node ../../scripts/check-i18n.mjs` | Loose untyped JSON | Typed Resources: key autocomplete + call-site drift gate with zero new tooling; completeness enforced in build, not by tsc |
| D7 | Print-time translation | Builders take optional `t` defaulting to `i18n.t`: `buildPackageLabelHtml(pkg, companyName?, t = i18n.t)`; `buildReceiptHtml(payment, t)` fed from `useTranslation().t`. Print `<html lang>` from `i18n.language`; alerts use `i18n.t` | Module-level `i18n.t` only | Keeps builders pure/testable, call sites unchanged; receipt uses `formatCurrency`/`formatDateTime` |
| D8 | Slices | S1 infra+shell; S2 auth+admin CRUD; S3 client+Dashboard+Reports+Payment list/form (pluralization, METHOD_LABELS dedupe); S4 PaymentDetailPage (screen+receipt atomic) + packageLabel + formatDate/currency/formatNumber + sweep + check script | Per-file splits | Clear start/finish, green build, isolated keys, revertable |

## Data Flow

```
main.tsx ──► i18n/index.ts (init: lng=localStorage.language||'es'; document.lang)
LanguageSwitcher ──setLanguage(lng)──► i18n ──useTranslation()──► components re-render
   i18n.language ──► formatDate.ts / formatCurrency.ts / print builders (t at print time)
```

## File Changes

| File | Action | Slice |
|------|--------|-------|
| `apps/web/package.json` (+i18next, react-i18next) | Modify | S1 |
| `src/i18n/{index.ts,languages.ts,i18next.d.ts}`, `src/i18n/locales/{es,en,fr}.json` | Create | S1 |
| `src/components/settings/LanguageSwitcher.tsx` | Create | S1 |
| `src/main.tsx` | Modify | S1 |
| `SettingsPage.tsx`, `components/layout/{Sidebar,Navbar,AuthLayout,AdminLayout,ClientLayout}.tsx`, `components/ui/{Badge,Table,CustomerSearchInput}.tsx`, `components/notifications/NotificationBell.tsx` | Modify | S1 |
| 16 pages: auth×2, companies×3, customers×3, packages×3, deliveries×1, users×2, branches×2 | Modify | S2 |
| `pages/admin/DashboardPage.tsx`, `pages/client/{ClientDashboardPage,MyPackagesPage,PackageDetailPage}.tsx`, `ReportsPage.tsx`, `payments/{PaymentListPage,PaymentFormPage}.tsx` | Modify | S3 |
| `utils/formatDate.ts`, `utils/formatCurrency.ts`, `utils/formatNumber.ts` (new), `utils/packageLabel.ts`, `payments/PaymentDetailPage.tsx`, `scripts/check-i18n.mjs` (new) | Modify/Create | S4 |

`index.html`/`App.tsx`: unchanged (static `lang="es"` = pre-JS fallback; no App effect).

## Interfaces / Contracts

```ts
const SUPPORTED_LANGUAGES = ['es', 'en', 'fr'] as const;
setLanguage(lng): void;   // validate → changeLanguage + localStorage('language')
getActiveLocale(): string; // 'es-DO' | 'en-US' | 'fr-FR'
declare module 'i18next' { interface CustomTypeOptions { defaultNS: 'translation';
  resources: typeof import('./locales/es.json'); } }
const resources = { es, en: en as typeof es, fr: fr as typeof es }; // one-directional: casts catch neither missing nor extra keys (comparability) — real completeness gate is scripts/check-i18n.mjs in the build
buildPackageLabelHtml(pkg, companyName?, t: TFunction = i18n.t): string;
// LanguageSwitcher: <select value={i18n.language} onChange={e => setLanguage(e.target.value)} aria-label={t('settings.language')}>
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Static | Key completeness (en/fr ⊇ es) | call-site key gate via typed Resources (per slice) + `check-i18n.mjs` deep diff, wired into the web `build` (runs after `vite build`) |
| Manual | Locale mapping + print artifacts (label, receipt) | Node REPL spot-checks; print all 3 languages in verify; grep for residual Spanish JSX |

**No vitest** — no test-tooling precedent; compile-time gate beats a runtime test for key drift.

## Rollout

No data/DB migration. `localStorage('language')` is the only persistence; absent → `es` (current behavior). Chained PRs S1→S4 (each targeting the previous branch, `tsc -b` green). Rollback: `git revert` per slice; removing the localStorage key restores Spanish. Offline-safe (no network fetches); unsupported stored language → `es`; missing keys fall back to `es`; `saveMissing` off.

## Open Questions

- Per-language default date pattern for `en`? Kept `dd/MM/yyyy` for v1.
- French quality: machine-grade v1 accepted (spec R6).
