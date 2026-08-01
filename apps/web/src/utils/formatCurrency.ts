import { getActiveLocale } from '../i18n';

/**
 * Format a number as currency.
 * Design D1 (language-bound display, currency-bound symbol): the display locale
 * follows the active language (`es→es-DO`, `en→en-US`, `fr→fr-FR`) while the
 * symbol follows the tenant currency passed to `Intl`. E.g. USD rendered while
 * Spanish is active shows "US$" — deliberate behavior change, one-line revert
 * if undesired. Falls back to the user's configured currency from localStorage.
 * `@courier/helpers` is untouched (the API shares it).
 */
export function formatCurrency(amount: number, currency?: string): string {
  const activeCurrency = currency || localStorage.getItem('currency') || 'DOP';
  return new Intl.NumberFormat(getActiveLocale(), {
    style: 'currency',
    currency: activeCurrency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
}
