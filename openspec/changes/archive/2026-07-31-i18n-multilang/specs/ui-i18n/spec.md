# UI i18n Specification

## Purpose

Localizes the entire `apps/web` UI to Spanish (default), English, and French: i18next + react-i18next with bundled JSON resources, a Settings-page language selector, locale-aware date/currency/number formatting, and print artifacts translated at print time. UI-only — backend, email templates, and `@courier/constants` internals are out of scope.

## Requirements

### Requirement: i18n Infrastructure

The system MUST initialize i18next + react-i18next in `apps/web` with bundled JSON resources for `es`, `en`, and `fr`, `es` as fallback, and localStorage key `language` for persistence. The system MUST NOT auto-detect browser language and MUST sync `document.documentElement.lang` to the active language.

#### Scenario: First load defaults to Spanish
- GIVEN a user with no `language` value in localStorage
- WHEN the app initializes
- THEN the UI MUST render in Spanish
- AND `document.documentElement.lang` MUST be `es`

#### Scenario: Missing key falls back to Spanish
- GIVEN a key missing from the active language file
- WHEN the UI resolves that key
- THEN the Spanish value MUST be displayed

### Requirement: Language Selection and Persistence

The system MUST provide a LanguageSwitcher on the admin Settings page with `es`, `en`, and `fr` options. Switching MUST update the entire UI immediately without a reload, MUST persist the choice to localStorage key `language`, and MUST restore it on the next load.

#### Scenario: Switching updates the whole UI
- GIVEN the Settings page is open
- WHEN the user selects English
- THEN all UI copy MUST change to English without reload
- AND the choice MUST be stored in localStorage

#### Scenario: Choice persists across reloads
- GIVEN the user previously selected French
- WHEN the app reloads
- THEN the UI MUST render in French

### Requirement: Hardcoded Copy Migration

The system MUST migrate all hardcoded UI copy (~43 files, ~500–600 strings) to translation keys grouped by prefix (`nav.*`, `status.*`, `payment.method.*`, `common.*`, `form.*`, `dashboard.*`, `reports.*`, `settings.*`, `client.*`, `label.*`, `error.*`, `confirm.*`). Status labels MUST resolve via `status.{slug}` at the UI layer without modifying `@courier/constants`; payment-method labels MUST use `payment.method.*` keys. The system SHOULD leave no hardcoded Spanish JSX text (grep-verified).

#### Scenario: All strings resolve from keys
- GIVEN a page renders in any supported language
- WHEN it displays UI copy
- THEN every string MUST come from a translation key

#### Scenario: Status and method labels localized
- GIVEN a package with status `recibido_miami` and a payment with method `cash`
- WHEN their badges render
- THEN labels MUST match the active language

### Requirement: Locale-Aware Date, Currency, and Number Formatting

The system MUST format dates with date-fns locales mapped from the active language (`es`→`es`, `en`→`enUS`, `fr`→`fr`) and MUST align currency/numbers to the selected locale. The payment receipt MUST use `formatCurrency` instead of raw amounts.

#### Scenario: Dates follow the active language
- GIVEN a page showing dates
- WHEN the user switches from Spanish to French
- THEN dates MUST render in the French locale

#### Scenario: Receipt amounts use locale formatting
- GIVEN the payment receipt is built in English
- THEN amounts MUST use locale-consistent currency formatting

### Requirement: Translated Print Artifacts

The system MUST translate the package label and payment receipt HTML at print time using the active language.

#### Scenario: Label prints in the selected language
- GIVEN a user who selected English
- WHEN the package label prints
- THEN all label text MUST be English

### Requirement: Translation Completeness

The system SHOULD ship complete `en` and `fr` resources; French v1 MAY be machine quality. Every key present in `es` MUST exist in `en` and `fr`.

#### Scenario: Key completeness across resources
- GIVEN `es`, `en`, and `fr` resource files
- WHEN a completeness check runs
- THEN `en` and `fr` MUST contain every key present in `es`
