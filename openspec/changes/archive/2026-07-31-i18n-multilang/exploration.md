# Exploration: i18n-multilang

Full UI internationalization for the courier web app: Spanish (current), English, and French, with a language selector on the admin settings page.

## Current State

- **Stack**: React 18.3 + TypeScript 5.7 + Vite 6 + Redux Toolkit 2.5 + react-router-dom 6 + Tailwind 3.4 + date-fns 4.1 + recharts. No i18n library, no frontend test tooling. Monorepo with shared packages `@courier/constants` (CommonJS) and `@courier/helpers` (CommonJS), both consumed by `apps/api` and `apps/web`.
- **100% of UI copy is hardcoded Spanish** across `apps/web/src`. Measured footprint: **43 of 78 tsx/ts files** contain Spanish UI strings; ~**465 line-level matches** (many lines bundle multiple strings; realistic total ≈ 500–600 strings).
- **Existing client-side persistence precedent** (theme): `App.tsx` reads `localStorage.getItem('theme')`, dispatches to `uiSlice`, and writes back on change; `document.documentElement.classList` toggles the dark class. The `index.html` root is hardcoded `<html lang="es">`.
- **Existing currency precedent**: `apps/web/src/utils/formatCurrency.ts` reads `localStorage.getItem('currency')` (default `'DOP'`) and delegates to `@courier/helpers` `formatCurrency`, which maps **currency → locale** (`DOP → es-DO`, `USD → en-US`, `EUR → de-DE`) via `Intl.NumberFormat`. The SettingsPage writes `localStorage.setItem('currency', ...)` after loading/saving tenant settings.
- **Dates**: `apps/web/src/utils/formatDate.ts` hardcodes the `es` locale from `date-fns/locale` for `formatDate`/`formatDateTime`/`formatRelative`. Consumed by 12 files (NotificationBell, DashboardPage, DeliveryListPage, CustomerDetail/List, client PackageDetailPage, PaymentDetail/List, ClientDashboardPage, PackageList/Detail).
- **Status labels**: central map `STATUS_LABELS` (10 statuses: `recibido_miami` → 'Recibido Miami', etc.) lives in `packages/constants/src/index.js` and is rendered by `components/ui/Badge.tsx` (`StatusBadge`). The API consumes `PACKAGE_STATUSES`/`STATUS_TRANSITIONS` from the same package but **not** `STATUS_LABELS` — so the label map is UI-only today, yet lives in a shared, backend-coupled package.
- **Payment method labels**: duplicated twice — `METHOD_LABELS` in `PaymentDetailPage.tsx` and `ReportsPage.tsx` (cash/card/transfer → Efectivo/Tarjeta/Transferencia).
- **Print artifacts with hardcoded Spanish** (in-scope, UI-side): `utils/packageLabel.ts` (100×60mm package label HTML: "Paquete", "Cliente", "Peso", "Código", "Fecha", "Sucursal", "Descripción" + alert strings) and `PaymentDetailPage.buildReceiptHtml` (A4 receipt: "Recibo de Pago", "Cliente", "Monto pagado", "Pagado", "Paquetes incluidos", totals, "Gracias por confiar en nosotros."). The receipt uses raw `$`-prefixed `.toFixed(2)` amounts and `toLocaleString('es-DO')` — it does NOT use `formatCurrency`/`formatDate`.
- One raw `Intl` call outside the utils: `PaymentDetailPage.tsx:56` `toLocaleString('es-DO', ...)`.
- `uiSlice` holds theme/sidebar/socket state; no language state exists anywhere.

## Affected Areas

- `apps/web/src/main.tsx` — i18n init site (needs `i18n` import before render; entry point confirmed).
- `apps/web/src/App.tsx` — theme persistence precedent to mirror for language; place for `<Suspense>`/init side effects.
- `apps/web/index.html` — `<html lang="es">` must become dynamic (`document.documentElement.lang`).
- `apps/web/src/pages/admin/settings/SettingsPage.tsx` — home of the new LanguageSwitcher; page itself is 128 lines of hardcoded Spanish ("Configuración", "Moneda", "Guardar", "Error al guardar", …).
- `apps/web/src/utils/formatDate.ts` — hardcoded `es` locale → switch to active locale.
- `apps/web/src/utils/formatCurrency.ts` + `packages/helpers/src/index.js` — currency→locale map (helpers shared with API: do NOT change; override/extend at web util layer if needed).
- `packages/constants/src/index.js` — `STATUS_LABELS` (10 keys) rendered by `StatusBadge`; translate at UI layer via i18n keys keyed by status slug.
- `apps/web/src/components/layout/{Sidebar,Navbar,ClientLayout}.tsx`, `components/ui/{Table,Badge,CustomerSearchInput}.tsx`, `components/notifications/NotificationBell.tsx` — layout/nav/aria strings.
- 27 page files under `apps/web/src/pages/**` (auth, admin: companies/customers/packages/payments/deliveries/users/branches/reports/settings/dashboard; client: dashboard/packages) — all contain hardcoded Spanish.
- `apps/web/src/utils/packageLabel.ts` — package print label HTML (Spanish + alerts).
- `apps/web/src/pages/admin/payments/PaymentDetailPage.tsx` — receipt print HTML + `METHOD_LABELS` + raw Intl call.
- `apps/web/src/pages/admin/reports/ReportsPage.tsx` — duplicate `METHOD_LABELS`, stats copy, pluralization ("1 pendiente" / "n pendientes").
- `apps/web/src/pages/admin/packages/PackageListPage.tsx` — status filter `<option>` labels (Spanish, duplicated with STATUS_LABELS).

## Hardcoded String Inventory (grouped)

| Group | Files | Representative strings | Notes |
|---|---|---|---|
| Navigation / shell | Sidebar, Navbar, ClientLayout, AuthLayout, AdminLayout | "Dashboard", "Empresas", "Clientes", "Paquetes", "Pagos", "Entregas", "Usuarios", "Sucursales", "Reportes", "Configuración", "Salir", aria-labels | High reuse; nav labels ~10 keys |
| Auth | LoginPage, ChangePasswordPage | "Correo electrónico", "Contraseña", "Nueva contraseña", "Confirmar nueva contraseña", "Mínimo 8 caracteres…", "Cancelar" | |
| Dashboard | DashboardPage | "Clientes registrados", "Recibidos hoy", "En tránsito", "Disponibles", "Entregados hoy", "Ingresos hoy", "Cobros pendientes", "Últimos movimientos", "Sin actividad reciente", "Sistema" | |
| Companies (superadmin) | CompaniesPage, CreateCompanyPage, EditCompanyPage | "Buscar", "Editar", "Eliminar", destructive-confirm dialog (long string), "Nombre de la empresa", "Slug (identificador único)", "Email del administrador", placeholders | Confirm dialog is a complex interpolated string |
| Customers | CustomerList/Form/Detail | "Nuevo Cliente", "Editar", "Apellido", "Documento", "Teléfono", "Total pagado", "Creado:" | |
| Packages | PackageList/Form/Detail | "Nuevo Paquete", "Tracking del carrier (UPS/FedEx)", "Valor declarado (USD)", "Cambiar estado", "Historial de estados", "Todos los estados", status filter options | Status options duplicate STATUS_LABELS |
| Payments | PaymentList/Form/Detail | "Nuevo Pago", "Monto a pagar", "Pagar ${amount}", "Método", "Estado", "Pagado", "Pendiente", "Recibo #", "Imprimir Recibo", "Descargar PDF", "Volver a pagos", METHOD_LABELS ×2 | Largest file (446 lines); receipt HTML ~30 strings |
| Deliveries | DeliveryListPage | "Buscar por tracking, destinatario o dirección…", "Nombre del destinatario", "Documento del destinatario", confirm dialogs ("¿Completar la entrega del paquete…?") | Includes modal |
| Users / Branches | UserList/Form, BranchList/Form | "Nuevo Usuario", "Editar Usuario", password hint, "Nueva Sucursal", "Código", "Ej: STS" | |
| Reports | ReportsPage | "Total cobrado", "Transacciones", "Pendientes", "Promedio por transacción", "Por método de pago", "% del total", pluralization "pendiente(s)" | Pluralization case needed |
| Settings | SettingsPage | "Configuración", "Nombre de la empresa", "Dirección", "Moneda", "Precio por libra", "Precio mínimo", "ITBIS (%)", "Guardar", "Guardado", "Error al guardar", currency names ("Peso dominicano") | LanguageSwitcher home |
| Client portal | ClientDashboardPage, MyPackagesPage, client PackageDetailPage | "Mis Paquetes", "En tránsito", "Disponibles", "Entregados", "No tienes paquetes registrados", "No se pudieron cargar tus paquetes…", headers (Tracking/Descripción/Peso/Estado/Fecha) | |
| Status labels | constants STATUS_LABELS + PackageListPage options | 10 status labels ("Recibido Miami", "En Tránsito", "Disponible", "Entregado", …) | Highest-value reusable group |
| Print artifacts | packageLabel.ts, PaymentDetailPage buildReceiptHtml | "Etiqueta", "Paquete", "Cliente", "Peso", "Código", "Fecha", "Sucursal", "Descripción", "Recibo de Pago", "Monto pagado", "Pagado", "Paquetes incluidos", "Subtotal", "ITBIS (18%)", "TOTAL", "Notas", "Gracias por confiar en nosotros.", alerts | Hidden inside HTML template literals; risk area |
| Errors/alerts (misc) | DashboardPage, UserListPage, SettingsPage, reports, packageLabel | "Error al guardar", "Error al cambiar estado", "Error al cargar reportes", pop-up blocked alerts | `alert()`/`confirm()` strings |

Highest-value / most-reused strings: the 10 status labels, 10 nav labels, payment-method labels (×2 duplicated), form verbs (Guardar/Cancelar/Editar/Eliminar/Buscar/Nuevo), and common table headers (Tracking/Descripción/Peso/Estado/Fecha/Total) — these should be first-class i18n keys.

## Approaches

1. **react-i18next (i18next 26.3.6 + react-i18next 17.0.11)** — *recommended*
   - Pros: Battle-tested React bindings; full TypeScript support (TS 5.7 peer-compatible, type-safe `t()` with typed namespaces); built-in interpolation, plurals (e.g. `_one/_other` for "1 pendiente"/"n pendientes"), and formatting options; lazy loading via `i18next-http-backend` (or Vite `import()` of JSON — simple since all locales live in-app); `useTranslation` hook works everywhere incl. inside the print functions via `i18n.t` singleton; language detection via `i18next-browser-languagedetector` (supports localStorage + navigator); zero build-config changes (no macros/babel) — safe for Vite 6 + `tsc -b` build; proven React 18 compatibility.
   - Cons: JSON locale files need discipline to keep keys in sync across 3 languages; adds ~2 deps (+ optional detector/backend).
   - Effort: Low-Medium

2. **react-intl / FormatJS (react-intl 10.1.19)**
   - Pros: First-class ICU message syntax with powerful plural/select rules; `IntlProvider` React-centric; strong a11y/date/number integration (`FormattedDate`, `FormattedNumber`).
   - Cons: Requires wrapping the whole app in `<IntlProvider>`; extraction toolchain (`@formatjs/cli`) adds config; `.po`/`.json` message catalogs require babel/swc plugin setup for message extraction (more build friction on Vite); no built-in lazy loading — locales are bundled via dynamic `import()` of message files (manual); date-fns locale switching is still manual. Plural/interpolation equally capable but heavier ceremony for this codebase's simple needs.
   - Effort: Medium-High

3. **Lingui (6.6.0, @lingui/react + @lingui/core)**
   - Pros: Modern, typed, excellent DX; ICU plurals; `@lingui/vite-plugin` exists for Vite; compiles catalogs to JS at build time (no runtime JSON parsing).
   - Cons: Requires macro/compiler setup in the Vite + `tsc -b` pipeline (babel-plugin-macros or `@lingui/loader`); more moving parts than the codebase currently has (zero build tooling); team must adopt the extract/compile workflow; overkill for 3 static languages in a single SPA.
   - Effort: Medium-High

## Recommendation

**Use i18next + react-i18next** (i18next ^26, react-i18next ^17) with **plain JSON resources bundled via Vite `import()`** (no http-backend needed — 3 static languages shipped with the SPA), and **manual language resolution from localStorage** mirroring the existing theme/currency pattern (skip i18next-browser-languagedetector initially — the existing codebase precedent is explicit localStorage + Redux; detector can be added later).

Concrete reasons for this stack:
- **TS support**: `react-i18next` v17 declares `typescript: ^5` peer (matches 5.7); typed `t()` with `Resources` interface gives compile-time key checking — critical for a 500+ string migration.
- **React 18 + Vite 6**: plain runtime library, no macros/babel/loader — zero changes to `vite.config.ts` or the `tsc -b` build; only `main.tsx` gains an import + init call.
- **Lazy loading**: trivially achieved with Vite dynamic `import('./locales/en.json')` per language; or skip lazy loading entirely and ship all 3 (each ~10–20 KB) — either works with JSON resources.
- **Interpolation**: `t('confirmDelete', { name, databaseName })` cleanly covers the destructive-confirm dialog in CompaniesPage.
- **Pluralization**: `t('pendingCount', { count })` with `_one`/`_other` covers ReportsPage "1 pendiente"/"n pendientes".
- **date-fns locale alignment**: i18next's `i18n.language` gives the single source of truth; map `es|en|fr` → `date-fns/locale` (`es`, `enUS`, `fr`) in `formatDate.ts` and switch on language change (subscribe via `i18n.on('languageChanged')` or re-render through `useTranslation`).
- **Framework-agnostic singleton**: `i18n.t()` works inside non-React code (print HTML builders `packageLabel.ts`, `buildReceiptHtml`), which react-intl cannot do without the provider.

## Recommended Architecture

```
apps/web/src/i18n/
├── index.ts            # i18n init: resources, fallbackLng 'es', interpolation config, languageChanged -> document.lang + date-fns locale cache
├── locales/
│   ├── es.json         # source of truth (keys = current Spanish strings)
│   ├── en.json         # English translation
│   └── fr.json         # French translation
└── LanguageSwitcher.tsx# or components/settings/LanguageSwitcher.tsx
```

- **Key namespacing**: single flat namespace `translation` for ~500 keys, grouped by prefix for maintainability: `nav.*` (10), `status.*` (10, keyed by backend slug: `status.recibido_miami`), `payment.method.*` (3), `common.*` (Guardar/Cancelar/Editar/Eliminar/Buscar/…), `form.*`, `dashboard.*`, `reports.*`, `settings.*`, `client.*`, `label.*` (print artifacts), `error.*`, `confirm.*`.
- **Status labels**: migrate `StatusBadge` (Badge.tsx) to `t(`status.${status}`)` and keep `STATUS_LABELS` in `packages/constants` untouched (shared package, backend imports it — avoid coupling). Same for `METHOD_LABELS`: replace both local duplicates with `t('payment.method.cash')` etc.
- **LanguageSwitcher component**: a `<select>` (mirroring the currency select styling in SettingsPage) with `value={i18n.language}` and `onChange` → `i18n.changeLanguage(locale)`; options: `es` (Español), `en` (English), `fr` (Français). Placed on SettingsPage as a new Card/section ("Idioma" / "Language"). Optionally also in Navbar later (out of scope).
- **Persistence**: localStorage key **`language`** (precedent: `theme`, `currency`). Write on change in the LanguageSwitcher (or an effect); read at init in `i18n/index.ts`. Default detection: **explicit Spanish default** (`fallbackLng: 'es'`) — do NOT auto-detect from `navigator.language` in v1: the tenant is Dominican, all backend copy/currency is Spanish-centric, and silent locale switching is a support risk. (Document `i18next-browser-languagedetector` as a future option.)
- **Redux**: optional `language` field in `uiSlice` mirroring `theme`; not strictly required (i18next holds the state) — recommend keeping it out of Redux for v1 to avoid dual sources of truth; `useTranslation()` re-renders on language change.
- **document.lang**: init sets `document.documentElement.lang = i18n.language`; keep in sync via `i18n.on('languageChanged', lng => document.documentElement.lang = lng)`; update `index.html` `lang="es"` stays as the pre-hydration default (correct — es is the fallback).
- **Dates**: rewrite `formatDate.ts` to pick `date-fns/locale` from a `language → locale` map (`es → es`, `en → enUS`, `fr → fr`), reading `i18n.language` at call time (cache the resolved locale on languageChanged). All 12 call sites keep their signatures — no component changes needed.
- **Numbers/currency**: keep the existing **currency-bound** locale map in `@courier/helpers` untouched (DOP→es-DO, USD→en-US, EUR→de-DE — money formatting follows the currency, which is correct for a Dominican multi-currency courier). For the receipt/print HTML (currently raw `$...toFixed(2)`), switch to `formatCurrency` + the resolved locale so French/English users get locale-consistent output. Optional follow-up: extend the web-side `formatCurrency` wrapper to accept a locale override derived from `i18n.language` if the team prefers language-bound formatting — decision deferred to design phase.
- **Print HTML**: `packageLabel.ts` and `buildReceiptHtml` build strings via `i18n.t()` at call time (singleton works without React); the cooldown/`window.open` logic is unaffected.

## Risks

- **Print artifacts** (package label + payment receipt): Spanish is baked into HTML template literals inside utility functions; must be translated with `i18n.t()` at print time, not import time. Regressions surface only when printing — manual verification required. Receipt also has raw `$` amounts and `toLocaleString('es-DO')` — needs `formatCurrency`/`formatDate` alignment.
- **`@courier/constants` coupling**: `STATUS_LABELS` lives in the shared package consumed by the API (which imports `PACKAGE_STATUSES`/`STATUS_TRANSITIONS` from it). Do not edit or remove the package; translate at the UI layer only.
- **`formatDate.ts` locale hardcode**: `es` is imported statically; forgetting to switch it leaves dates in Spanish while UI is English/French — the most likely silent bug. Mitigate by centralizing the locale map in one module + a languageChanged subscription.
- **~500–600 keys × 3 languages**: key drift between `es/en/fr.json` (missing keys fall back to `es` silently). Mitigate with typed `Resources` + a strict key-completeness check in CI/apply phase.
- **`confirm()`/`alert()` strings and aria-labels**: easy to miss during migration (they are not JSX text nodes); inventory already captures them.
- **Pluralization edge**: "1 pendiente / 2 pendientes" (ReportsPage) needs i18next plural forms; naive string concatenation must not survive migration.
- **`index.html` `lang="es"`** static attribute: fine as fallback, but `document.documentElement.lang` must be updated on change for correct a11y/translation of native inputs (date picker, `type="date"` in ReportsPage renders per browser language).

## Scope Estimate (implementation phase forecast)

- ~43 source files touched (32 confirmed via accents + 11 accent-less), dominated by 27 pages + 4 layouts + 4 ui components + 2 utils (`formatDate`, `formatCurrency` wrapper) + 2 print builders + `main.tsx`/`App.tsx` + `index.html`.
- Approx **500–600 strings** extracted into `es.json` (source) with `en.json`/`fr.json` translations.
- Estimated delta: **~1,500–2,000 lines** changed (additions + deletions) across ~48 files including 3 locale JSON files.
- **400-line review budget risk: High** — chained PRs recommended (slice 1: i18n init + infra + LanguageSwitcher + settings/nav; slice 2: auth + admin CRUD pages; slice 3: client portal + reports/pluralization; slice 4: print artifacts + formatDate/currency alignment + final sweep).
- Test tooling: none in frontend — adding a lightweight i18n key-completeness test (node script) is recommended but optional.

## Ready for Proposal

Yes. Recommendation: **i18next + react-i18next** with bundled JSON resources, localStorage key `language`, Spanish default fallback, LanguageSwitcher `<select>` on SettingsPage, and print/date/currency alignment as described. The orchestrator should tell the user: scope is UI-only (backend/email excluded — confirmed no backend changes needed; `@courier/constants` stays untouched); expect a chained PR delivery due to the ~1,500–2,000 line footprint; French translations will need review by a human (or accept machine-quality French in v1).
