import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

/**
 * MINIMAL i18n scaffold (task 5.3/5.4). This is NOT the full localization
 * system — that ships in task 5.9 (`apps/mobile/src/i18n` full setup reusing
 * web `status.*`/`common.*` conventions). Today we only need enough to keep the
 * login + registration screens free of hardcoded user-facing strings and to
 * mirror the web key conventions (nested dotted keys, {{param}} interpolation).
 *
 * The exported `t()` reads a flat key map from the active locale and falls
 * back through en → es so a missing translation never blanks the UI.
 */

export type SupportedLanguage = 'es' | 'en' | 'fr';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['es', 'en', 'fr'];

/** Device-locale sniff that safely falls back to the default. */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const resources: Record<SupportedLanguage, Record<string, string>> = { es, en, fr };

/** Resolve a possibly-nested dotted key from a flat locale map. */
function lookup(locale: Record<string, string>, key: string): string | undefined {
  return locale[key];
}

function currentLanguage(): SupportedLanguage {
  // Expo constants is not always loaded in unit tests; default to `en`.
  if (typeof globalThis !== 'undefined' && (globalThis as any).__COURIER_I18N_LANG__) {
    return (globalThis as any).__COURIER_I18N_LANG__ as SupportedLanguage;
  }
  return DEFAULT_LANGUAGE;
}

/** Active language — used e.g. to pass the device language to OTP emails (D6). */
export function getCurrentLanguage(): SupportedLanguage {
  return currentLanguage();
}

/** Translate a dotted key with optional {{param}} interpolation. */
export function t(key: string, params?: Record<string, string | number>): string {
  const lang = currentLanguage();
  let raw = lookup(resources[lang], key);
  if (raw === undefined) raw = lookup(resources.en, key);
  if (raw === undefined) raw = lookup(resources.es, key);
  if (raw === undefined) return key;

  if (!params) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    name in (params as Record<string, string | number>) ? String((params as any)[name]) : `{{${name}}}`,
  );
}

// Setter only used by tests / future locale switching (5.9). Exported now so
// the login/registration screens can be tested against non-default locales.
export function setI18nLanguage(lang: SupportedLanguage): void {
  (globalThis as any).__COURIER_I18N_LANG__ = lang;
}