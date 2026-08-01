/**
 * HTML-escapes a string for safe interpolation into markup that is built via
 * string concatenation (e.g. print-window HTML written with
 * `document.write`). i18next runs with `escapeValue: false`, so any
 * user-derived value inserted into raw HTML must be escaped at the call site.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
