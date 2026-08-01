/**
 * Pure language constants and guards. This module MUST NOT import the i18n
 * instance (./index): index.ts imports isSupportedLanguage from here, so any
 * runtime dependency on index would create a circular import and a temporal
 * dead zone (e.g. "Cannot access 'SUPPORTED_LANGUAGES' before initialization").
 * Instance-dependent helpers live in ./index (getActiveLanguage, getActiveLocale, setLanguage).
 */

export const SUPPORTED_LANGUAGES = ['es', 'en', 'fr'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** BCP-47 locale used for date/currency/number formatting per active language. */
export const LANGUAGE_LOCALES: Record<SupportedLanguage, string> = {
  es: 'es-DO',
  en: 'en-US',
  fr: 'fr-FR',
};

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
