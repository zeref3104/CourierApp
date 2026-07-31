import { formatCurrency as formatCurrencyHelper } from '@courier/helpers';

/**
 * Format a number as currency.
 * Falls back to the user's configured currency from localStorage when no currency is passed.
 * Core formatting (per-currency locales) is delegated to @courier/helpers.
 */
export function formatCurrency(amount: number, currency?: string): string {
  const activeCurrency = currency || localStorage.getItem('currency') || 'DOP';
  return formatCurrencyHelper(amount, activeCurrency);
}
