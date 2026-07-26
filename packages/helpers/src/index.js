/**
 * Shared helpers for Courier SaaS Platform.
 */

/**
 * Generate a tracking number in the format PREFIX-YYYYMMDD-NNNN.
 * @param {string} prefix - Tenant prefix (default 'CPR')
 * @param {number} sequence - Daily sequence number
 * @returns {string}
 */
function generateTrackingNumber(prefix = 'CPR', sequence = 1) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Generate a receipt number in the format RCP-YYYYMMDD-NNNN.
 * @param {number} sequence - Daily sequence number
 * @returns {string}
 */
function generateReceiptNumber(sequence = 1) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `RCP-${date}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Calculate package pricing.
 * @param {number} weight - Package weight in lbs
 * @param {number} pricePerLb - Price per pound
 * @param {number} minimumPrice - Minimum price
 * @param {number} taxRate - Tax rate percentage
 * @returns {{ baseCost: number, tax: number, total: number }}
 */
function calculatePricing(weight, pricePerLb, minimumPrice = 0, taxRate = 18) {
  let baseCost = weight * Number(pricePerLb);
  if (baseCost < Number(minimumPrice)) baseCost = Number(minimumPrice);
  const tax = baseCost * (Number(taxRate) / 100);
  const total = baseCost + tax;
  return { baseCost, tax, total };
}

/**
 * Format a number as currency.
 * @param {number} amount
 * @param {string} currency - Currency code (default 'DOP')
 * @returns {string}
 */
function formatCurrency(amount, currency = 'DOP') {
  return new Intl.NumberFormat('es-DO', {
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
  calculatePricing,
  formatCurrency,
  getTodayStart,
  getTodayEnd,
  getMonthStart,
  getMonthEnd,
  paginate,
};
