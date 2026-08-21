/**
 * Shared helpers for Courier SaaS Platform.
 */

/**
 * Generate a tracking number in the format PREFIX-YYYYMMDD-NNNN.
 * Pure formatter — the caller owns the atomic sequence counter.
 * @param {{ seq: number, date: string, prefix?: string }} params
 *   - seq: sequence number (from the per-tenant Counter)
 *   - date: YYYYMMDD date string
 *   - prefix: tenant prefix (default 'CPR')
 * @returns {string}
 */
function generateTrackingNumber({ seq, date, prefix = 'CPR' } = {}) {
  return `${prefix}-${date}-${String(seq).padStart(4, '0')}`;
}

/**
 * Generate a receipt number in the format RCP-YYYYMMDD-NNNN.
 * Pure formatter — the caller owns the atomic sequence counter.
 * @param {{ seq: number, date: string }} params
 *   - seq: sequence number (from the per-tenant Counter)
 *   - date: YYYYMMDD date string
 * @returns {string}
 */
function generateReceiptNumber({ seq, date } = {}) {
  return `RCP-${date}-${String(seq).padStart(4, '0')}`;
}

/**
 * Suggest a client code prefix from a company name (client-code-identity spec).
 * - Multi-word names: initials of each word, uppercased (e.g. "Rapid Box" -> "RB").
 * - Single-word names: first 2 letters (e.g. "Fedex" -> "FE").
 * - Non-letter characters are ignored; result is capped at 5 chars.
 * - The result is guaranteed to be at least 2 characters whenever the name
 *   contains at least one letter: letter-sparse names ("1234 Shipping" -> "SH")
 *   fall back to the name's letters, and a single-letter name is doubled
 *   ("A" -> "AA"). A name with no letters at all yields "" — the caller must
 *   then ask for an explicit prefix.
 * Pure helper — the caller decides whether to use the suggestion or an admin override.
 * @param {string} companyName
 * @returns {string}
 */
function suggestClientPrefix(companyName) {
  const words = String(companyName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lettersOf = (str) => str.replace(/[^A-Za-z]/g, '');
  let prefix;
  if (words.length === 1) {
    prefix = lettersOf(words[0]).slice(0, 2).toUpperCase();
  } else {
    prefix = words
      .map((word) => lettersOf(word).charAt(0).toUpperCase())
      .join('')
      .slice(0, 5);
  }
  if (prefix.length < 2) {
    const allLetters = words.map(lettersOf).join('').toUpperCase();
    if (allLetters.length === 0) return '';
    if (allLetters.length === 1) return allLetters.repeat(2);
    return allLetters.slice(0, 2);
  }
  return prefix;
}

/**
 * Generate a global client code in the format PREFIX-NNNNNN (client-code-identity spec).
 * Pure formatter — the caller owns the atomic sequence counter (master CompanyCounter).
 * @param {string} prefix - Platform-unique company prefix (2-5 uppercase letters)
 * @param {number} seq - Sequence number (from the master CompanyCounter)
 * @returns {string}
 */
function generateClientCode(prefix, seq) {
  return `${prefix}-${String(seq).padStart(6, '0')}`;
}

/**
 * Generate a customer code in the format CUS-NNNN.
 * @deprecated Use generateClientCode(prefix, seq) for new customers.
 * @param {number} seq - Sequence number (from the per-tenant Counter)
 * @returns {string}
 */
function generateCustomerCode(seq) {
  return `CUS-${String(seq).padStart(4, '0')}`;
}

/**
 * Calculate package pricing.
 * @param {number} weight - Package weight in lbs
 * @param {number} pricePerLb - Price per pound
 * @param {number} minimumPrice - Minimum price
 * @param {number} taxRate - Tax rate percentage (default 0 — the tenant
 *   `tax_rate` setting is the source of truth; 0 is the last-resort fallback)
 * @returns {{ baseCost: number, tax: number, total: number }}
 */
function calculatePricing(weight, pricePerLb, minimumPrice = 0, taxRate = 0) {
  let baseCost = weight * Number(pricePerLb);
  if (baseCost < Number(minimumPrice)) baseCost = Number(minimumPrice);
  const tax = baseCost * (Number(taxRate) / 100);
  const total = baseCost + tax;
  return { baseCost, tax, total };
}

/**
 * Format a number as currency.
 * Locales map per-currency so e.g. USD formats as en-US, not es-DO.
 * @param {number} amount
 * @param {string} currency - Currency code (default 'DOP')
 * @returns {string}
 */
function formatCurrency(amount, currency = 'DOP') {
  const locales = {
    DOP: 'es-DO',
    USD: 'en-US',
    EUR: 'de-DE',
  };
  return new Intl.NumberFormat(locales[currency] || 'es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Get the start of today (midnight).
 * @returns {Date}
 */
function getTodayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of today (23:59:59.999).
 * @returns {Date}
 */
function getTodayEnd() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get the start of the current month.
 * @returns {Date}
 */
function getMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Get the end of the current month.
 * @returns {Date}
 */
function getMonthEnd() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Paginate an array (in-memory).
 * @param {Array} items
 * @param {number} page
 * @param {number} limit
 * @returns {{ data: Array, meta: { page: number, limit: number, total: number, totalPages: number } }}
 */
function paginate(items, page = 1, limit = 20) {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    meta: { page, limit, total, totalPages },
  };
}

module.exports = {
  generateTrackingNumber,
  generateReceiptNumber,
  generateCustomerCode,
  suggestClientPrefix,
  generateClientCode,
  calculatePricing,
  formatCurrency,
  getTodayStart,
  getTodayEnd,
  getMonthStart,
  getMonthEnd,
  paginate,
};
