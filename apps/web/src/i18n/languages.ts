import i18n from './index';

export const SUPPORTED_LANGUAGES = ['es', 'en', 'fr'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** BCP-47 locale used for date/currency/number formatting per active language. */
const LANGUAGE_LOCALES: Record<SupportedLanguage, string> = {
  es: 'es-DO',
  en: 'en-US',
  fr: 'fr-FR',
};

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Active language, falling back to the Spanish default when not resolvable. */
export function getActiveLanguage(): SupportedLanguage {
  return isSupportedLanguage(i18n.language) ? i18n.language : 'es';
}

/** Locale of the active language (consumed by formatDate/formatCurrency/formatNumber). */
export function getActiveLocale(): string {
  return LANGUAGE_LOCALES[getActiveLanguage()];
}

/**
 * Persist the language choice and switch the active language.
 * Unknown values are ignored so a stale localStorage entry cannot break the app.
 */
export function setLanguage(lng: string): void {
  if (!isSupportedLanguage(lng)) return;
  localStorage.setItem('language', lng);
  void i18n.changeLanguage(lng);
}
