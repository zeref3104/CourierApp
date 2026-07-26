/**
 * Format a number as currency.
 * Falls back to the user's configured currency from localStorage when no currency is passed.
 */
export function formatCurrency(amount: number, currency?: string): string {
  const activeCurrency = currency || localStorage.getItem('currency') || 'DOP';

  const locales: Record<string, string> = {
    DOP: 'es-DO',
    USD: 'en-US',
    EUR: 'de-DE',
  };

  return new Intl.NumberFormat(locales[activeCurrency] || 'es-DO', {
    style: 'currency',
    currency: activeCurrency,
    minimumFractionDigits: 2,
  }).format(amount);
}
