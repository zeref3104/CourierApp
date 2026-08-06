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

/**
 * Spec default is Spanish (the backend OTP email / web UI default to `es`).
 * The device-locale sniff upgrades to the user's language when it matches a
 * supported locale, and safely falls back to `es`.
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

const resources: Record<SupportedLanguage, Record<string, string>> = { es, en, fr };

/** Resolve a possibly-nested dotted key from a flat locale map. */
function lookup(locale: Record<string, string>, key: string): string | undefined {
  return locale[key];
}

/** Normalize a BCP-47 locale tag (e.g. "en-US") to a supported language. */
function normalizeLocale(tag: string | null | undefined): SupportedLanguage | null {
  if (!tag) return null;
  const lang = tag.split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage) ? (lang as SupportedLanguage) : null;
}

/**
 * Detect the device language via expo-localization when available (native
 * runtime). Best-effort: any failure falls back to the spec default `es`.
 */
function detectDeviceLanguage(): SupportedLanguage | null {
  try {
    const { getLocales } = require('expo-localization') as {
      getLocales?: () => Array<{ languageCode?: string | null }>;
    };
    if (typeof getLocales !== 'function') return null;
    const locales = getLocales();
    const first = locales?.[0]?.languageCode ?? null;
    return normalizeLocale(first);
  } catch {
    return null;
  }
}

function currentLanguage(): SupportedLanguage {
  // Tests may pin a language explicitly; that always wins.
  if (typeof globalThis !== 'undefined' && (globalThis as any).__COURIER_I18N_LANG__) {
    return (globalThis as any).__COURIER_I18N_LANG__ as SupportedLanguage;
  }
  return detectDeviceLanguage() ?? DEFAULT_LANGUAGE;
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