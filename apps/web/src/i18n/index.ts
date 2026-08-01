import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import { isSupportedLanguage, LANGUAGE_LOCALES, type SupportedLanguage } from './languages';

const storedLanguage = localStorage.getItem('language');
const initialLanguage = isSupportedLanguage(storedLanguage) ? storedLanguage : 'es';

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    // The `as typeof es` casts do NOT enforce en/fr completeness: a subset
    // (missing key) and a superset (extra key) both satisfy the assertion,
    // so tsc accepts either direction. The typed gate only validates
    // call-site keys against es.json. en/fr completeness (missing + extra +
    // interpolation parity) is enforced by scripts/check-i18n.mjs, which runs
    // in the web build after vite (see apps/web/package.json).
    en: { translation: en as typeof es },
    fr: { translation: fr as typeof es },
  },
  lng: initialLanguage,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  // No browser auto-detection: Spanish is the explicit default and the only
  // stored preference that matters is localStorage('language').
});

/** Keep <html lang> in sync with the active language (a11y + native input locales). */
const syncDocumentLang = (lng: string) => {
  document.documentElement.lang = lng;
};
syncDocumentLang(i18n.language);
i18n.on('languageChanged', syncDocumentLang);

export { SUPPORTED_LANGUAGES, isSupportedLanguage } from './languages';
export type { SupportedLanguage } from './languages';

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

export default i18n;
