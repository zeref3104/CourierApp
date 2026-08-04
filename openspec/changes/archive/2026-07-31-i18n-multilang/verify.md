# Verification Report — i18n-multilang

**Change**: i18n-multilang | **Capability**: ui-i18n
**Version**: spec.md (final, all 4 slices S1–S4 applied)
**Mode**: Standard (no strict_tdd config; frontend-only change — verify per skill's frontend guidance: compile gates, key checks, grep sweeps, manual checklists)
**Artifact store**: both (OpenSpec verify.md + Engram `sdd/i18n-multilang/verify-report`)

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 22 |
| Tasks incomplete | 0 |

## Build & Tests Execution

**Build**: ✅ Passed (exit 0) — now also runs the completeness check
```text
npm run build --workspace @courier/web
> tsc -b && vite build && node ../../scripts/check-i18n.mjs
✓ 2729 modules transformed.
✓ built in 10.68s
i18n completeness check PASSED: 304 keys in es, en and fr (0 missing, 0 extra, interpolation params aligned)
EXIT_CODE=0
Warnings (pre-existing, non-blocking): axios dynamic-import notice; chunk >500 kB.
```

**Key completeness check (executed runtime)**: ✅ Passed — wired into the web `build` (after `vite build`); also runnable standalone
```text
node scripts/check-i18n.mjs
i18n completeness check PASSED: 304 keys in es, en and fr (0 missing, 0 extra, interpolation params aligned)
EXIT_CODE=0

npm run check:i18n --workspace @courier/web → same PASS, EXIT_CODE=0
```

**D1 currency behavior (executed runtime smoke, node Intl)**: ✅ verified
```text
es-DO DOP: RD$1,234.50   | es-DO USD: US$1,234.50   (D1 change confirmed)
en-US USD: $1,234.50     | fr-FR USD: 1 234,50 $US
```

**Tests**: ➖ No test runner — no vitest precedent in repo; design testing strategy is compile-gate + checks + manual (documented in design.md Testing Strategy).

**Coverage**: ➖ Not available (no coverage tooling).

## Spec Compliance Matrix

| Requirement | Scenario | Evidence | Result |
|-------------|----------|----------|--------|
| R1 i18n Infrastructure | First load defaults to Spanish | `src/i18n/index.ts:8-9` — `lng: localStorage.getItem('language')` validated via `isSupportedLanguage`, else `'es'`; `main.tsx:7` imports `./i18n` before `createRoot` (no flash); no browser auto-detect (no detector plugin, comment L20-21) | ✅ COMPLIANT (static, compile-gated) |
| R1 | Missing key falls back to Spanish | `src/i18n/index.ts:18` — `fallbackLng: 'es'` | ✅ COMPLIANT (static) |
| R2 Selection & Persistence | Switching updates whole UI without reload | `LanguageSwitcher.tsx:19-29` — `<select value={i18n.language} onChange={e => setLanguage(...)}>`; `setLanguage` → `i18n.changeLanguage` re-renders via `useTranslation` (36/38 modified src files consume useTranslation or i18n.t; main.tsx and packageLabel.ts are the documented exceptions); localStorage write at `languages.ts:34` | ✅ COMPLIANT (static wiring; live no-reload visual update requires manual browser check — see Manual checklist C) |
| R2 | Choice persists across reloads | `languages.ts:34` `localStorage.setItem('language', lng)`; init reads same key `index.ts:8` | ✅ COMPLIANT (static; reload restore requires manual browser check — Manual checklist C) |
| R3 Hardcoded Copy Migration | All strings resolve from keys | Grep sweep (accents + 24 common Spanish UI words + alert/confirm) across `apps/web/src`: zero residual user-facing Spanish. Only matches: `LanguageSwitcher.tsx:9` autonym `'Español'` (allowed), `PaymentDetailPage.tsx:59-60` legacy-data `Envío #` strip regex (documented intentional). All alert()/confirm() pass `t()` (16 hits, all `t(...)`). Dead `STATUS_LABELS`/`METHOD_LABELS`/`TYPE_LABELS`/`ROLE_LABELS`/`DELIVERY_TYPES` consts: zero references remain | ✅ COMPLIANT (grep evidence) |
| R3 | Status and method labels localized | `Badge.tsx:27-35` `StatusBadge` → `t('status.'+status, {defaultValue})`; `PaymentDetailPage.tsx:51,336` → `payment.method.*`; `status.recibido_miami` = "Recibido Miami/Received Miami/Reçu à Miami"; `payment.method.cash` = "Efectivo/Cash/Espèces" | ✅ COMPLIANT (static + sample values) |
| R4 Locale-Aware Formatting | Dates follow active language | `formatDate.ts:7-10` — `LOCALES = { es, en: enUS, fr }` from `date-fns/locale`, resolved at call time via `getActiveLanguage()`; same 3 signatures; 12 call sites unchanged | ✅ COMPLIANT (static; live switch visual requires manual check C) |
| R4 | Receipt amounts use locale formatting | `PaymentDetailPage.tsx` receipt builder uses `formatCurrency` for every amount (L70-72, 188, 219, 223, 228); no raw `$`/`toFixed`/`toLocaleString('es-DO')` remain; D1 runtime outputs verified above | ✅ COMPLIANT (static + runtime smoke) |
| R5 Translated Print Artifacts | Label prints in selected language | `packageLabel.ts:33-37` — `buildPackageLabelHtml(pkg, companyName?, t = i18n.t)`; `<html lang="${i18n.language}">` L53; all fields `t()`-driven; alerts `t('print.label.popupBlocked')`/`generateError` | ✅ COMPLIANT (static; browser print in 3 langs requires manual — Manual checklist A) |
| R6 Translation Completeness | Key completeness across resources | `scripts/check-i18n.mjs` is the completeness gate and now runs inside the web `build` (after `vite build`); executed: 304 keys es/en/fr, 0 missing, 0 extra, interpolation `{{param}}` names aligned across locales (16 interpolated keys, incl. plural `reports.pendingCount_one/_other`). NOTE (corrected per adversarial review M1): the typed gate does NOT prove en/fr completeness — the `typeof es` casts in `i18n/index.ts:14-15` are comparability assertions that a SUBSET (missing key) and a SUPERSET (extra key) both satisfy (verified by tsc fixture), and the typed Resources gate only validates call-site keys against es.json. `tsc -b` alone proves neither missing nor extra keys; the build's check-i18n.mjs step is the real gate | ✅ COMPLIANT (executed in build) |

**Compliance summary**: 11/11 scenarios compliant (static/runtime evidence; 3 require the manual browser checklist below to fully close out the visual/runtime aspects).

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| localStorage key `language` + Spanish default | ✅ Implemented | `i18n/index.ts:8-9`, validated, stale value → `es` |
| document.documentElement.lang sync | ✅ Implemented | `i18n/index.ts:25-29` — set at init + `languageChanged` subscription |
| No browser auto-detect | ✅ Implemented | no detector; explicit comment |
| LanguageSwitcher on Settings page | ✅ Implemented | `SettingsPage.tsx:136-139` Card + switcher; mirrors currency-select styling |
| `status.{slug}` resolution without touching @courier/constants | ✅ Implemented | `Badge.tsx` StatusBadge; `packages/` dir has zero git changes |
| date-fns locale map es→es / en→enUS / fr→fr | ✅ Implemented | `formatDate.ts` |
| formatCurrency language alignment (D1) | ✅ Implemented | `formatCurrency.ts`; runtime-verified US$ in es-DO |
| Print-time t injection | ✅ Implemented | `packageLabel.ts` default `i18n.t`; `PaymentDetailPage.tsx:269-272` `buildReceiptHtml(payment, t)` with useCallback deps `[payment, t]` |
| Completeness script | ✅ Implemented | `scripts/check-i18n.mjs` + `check:i18n` npm script, WIRED INTO the web `build` (runs after `vite build`); works from root and workspace cwd |
| Build fix (Option A) | ✅ Implemented | `vite.config.ts:31` `commonjsOptions.include: [/node_modules/, /packages\/(helpers|constants|validation)\//]` |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Receipt/currency (language-bound display, currency-bound symbol) | ✅ Yes | Runtime-verified; @courier/helpers untouched |
| D2 No language in Redux | ✅ Yes | i18next is single source of truth |
| D3 Static bundled JSON | ✅ Yes | Top-level imports in `i18n/index.ts:3-5` |
| D4 Init in main.tsx module side-effect; App.tsx unchanged | ✅ Yes | `main.tsx:7`; App.tsx has zero diff |
| D5 Date locale resolved at call time | ✅ Yes | `formatDate.ts` |
| D6 Key org + typed completeness | ✅ Yes (augmented) | Deviation: `resources: { translation: ... }` wrapper needed under i18next v26 types (documented in apply-progress #1); `roles.*` group added (8 keys) |
| D7 Print-time translation via injectable t | ✅ Yes (minor gap) | `printPackageLabel` passes its `t` to alerts only, NOT to `buildPackageLabelHtml` (L173) — behavior still correct (defaults to active `i18n.t`), see SUGGESTION-1 |
| D8 Four slices S1–S4 | ✅ Yes | All applied; single `tsc -b` covers the whole change |

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **Entire change is uncommitted** — `git log --oneline -15` shows no i18n commits; `git status` shows all 43 modified + untracked files (i18n/, settings/, formatNumber.ts, scripts/, openspec/) in the working tree. Tasks.md specified per-slice commits (AC: `Commit: feat(i18n)...`), so task 1.1–4.5 ACs were partially met (code done, commit action not executed). Not a spec-compliance failure (all gates green) but the orchestrator must commit/PR before archive and before the manual browser verification can run against a built artifact. (S1–S4 code is present and compiles; risk is delivery/process, not implementation.)

**SUGGESTION**:
1. `printPackageLabel` (packageLabel.ts:161) accepts injectable `t` but calls `buildPackageLabelHtml(pkg, companyName)` at L173 without forwarding it — the HTML ignores the injected `t` (only the alert strings use it). D7's purity/testability intent is only half-honored. Behavior is correct today (default `i18n.t` = active language at print time), so this is a fidelity gap, not a bug. Fix: pass `t` through at L173.
2. Circular import `i18n/index.ts` ↔ `i18n/languages.ts` (each imports the other). Safe today because `languages.ts` only references `i18n` inside function bodies (ESM live bindings) and `index.ts` only calls `isSupportedLanguage` (no `i18n` ref) at module eval; both `tsc -b` and vite build pass. Consider inlining the validator or moving `SUPPORTED_LANGUAGES` to a dependency-free module to remove the cycle.
3. apply-progress key inventory is slightly stale vs. the actual JSONs (e.g. `settings.*` listed as 27 but 19 actual, `common.*` 37 vs 40 actual after the +3 Pagination keys). The completeness check is authoritative (304×3 aligned); the inventory line is descriptive drift only. Update at archive time.
4. `apps/web/tsconfig.tsbuildinfo` is a tracked file that got modified by the build (2-line diff). Pre-existing tracking choice; harmless, but consider gitignoring it.

## Manual Browser Checklist (cannot be automated — required to close out R2/R4/R5 visual scenarios)

Prereq: `npm run dev --workspace @courier/web` + seeded tenant. For EACH language (es, en, fr): set language via Settings → Language selector (or localStorage `language`), then:

**A. Package label (100×60mm)**: Admin → Paquetes → open any package → "Imprimir etiqueta".
- `<html lang>` attribute equals active lang (DevTools on the print window); title "Etiqueta/Étiquete/Label {{tracking}}" matches active lang; fields Cliente/Customer/Client, Peso/Weight/Poids, Código/Code/Code, Fecha/Date/Date, Sucursal/Branch/Succursale, Descripción/Description/Description translated; date in active locale format (dd/MM/yyyy for all — pattern kept per design open question); barcode renders with tracking text; popup-blocked alert (block popups first) shows translated text.

**B. Payment receipt (A4)**: Admin → Pagos → open a payment → "Imprimir Recibo".
- `<html lang>` correct; title "Recibo de Pago/Payment Receipt/Reçu de paiement"; meta line "Fecha/Date/Date: ... | Método/Method/Méthode: Efectivo/Cash/Espèces" (method per lang); amounts use locale formatting (es-DO: RD$1,234.50; en-US: $1,234.50; fr-FR: 1 234,50 $US — currency from tenant setting); "Monto pagado/Amount paid/Montant payé"; status "Pagado/Paid/Payé"; table headers Tracking/Lbs/Precio x lb/ITBIS/Total per lang; Subtotal/ITBIS (18%)/TOTAL per lang; footer thanks + generatedAt lines translated; screen badges (method + status) match lang; package rows status badges localized.

**C. Persistence**: switch language → reload page → language persists; `document.documentElement.lang` matches after reload; a date column (e.g. Paquetes list) renders in the new locale without reload; dashboard stat cards and any chart/number formatting follow the language.

## Verdict

**PASS WITH WARNINGS** — all 22 tasks complete, both execution gates green (build exit 0; 304×3 keys aligned, 0 missing/extra, interpolation aligned), zero residual hardcoded Spanish, all 11 spec scenarios covered by static/runtime evidence with the 3 browser-only scenarios documented in the manual checklist. Warnings are process-level (uncommitted change) and minor design-fidelity gaps — no CRITICAL findings, no spec violations.
