import { getActiveLocale } from '../i18n/languages';

/**
 * Format a plain number using the active language's locale (e.g. 1234.5
 * renders "1.234,5" in es-DO and "1,234.5" in en-US).
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getActiveLocale(), options).format(value);
}
