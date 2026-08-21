/**
 * Unit tests for calculatePricing (@courier/helpers).
 * Covers the taxRate default change: the fallback moved from a hardcoded 18
 * to 0 — the tenant `tax_rate` setting is now the single source of truth and
 * 0 is the last-resort default when no setting exists.
 */
const { calculatePricing } = require('@courier/helpers');

describe('calculatePricing', () => {
  test('defaults taxRate to 0 when omitted (no surprise tax)', () => {
    const { baseCost, tax, total } = calculatePricing(10, 5, 0);
    expect(baseCost).toBe(50);
    expect(tax).toBe(0);
    expect(total).toBe(50);
  });

  test('applies an explicit tax rate', () => {
    const { baseCost, tax, total } = calculatePricing(10, 5, 0, 18);
    expect(baseCost).toBe(50);
    expect(tax).toBe(9);
    expect(total).toBe(59);
  });

  test('respects the minimum price floor before taxing', () => {
    const { baseCost, tax, total } = calculatePricing(1, 5, 100, 10);
    expect(baseCost).toBe(100);
    expect(tax).toBe(10);
    expect(total).toBe(110);
  });
});
