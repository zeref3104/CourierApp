import { format, formatDistanceToNow } from 'date-fns';
import { es, enUS, fr } from 'date-fns/locale';
import { getActiveLanguage } from '../i18n';

// Locale map resolved at call time (design D5): the active language drives the
// date-fns locale, so switching language re-renders dates without any cache.
const LOCALES = { es, en: enUS, fr };

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  return format(new Date(date), pattern, { locale: LOCALES[getActiveLanguage()] });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: LOCALES[getActiveLanguage()] });
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: LOCALES[getActiveLanguage()] });
}
