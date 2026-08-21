import {
  sortTimelineChronological,
  shouldShowAmountCard,
  pickupBranchOf,
  formatCurrency,
} from '@/lib/tracking';
import { PackageDetail, PackageHistoryEntry } from '@/api/clientPanel';

/**
 * Unit tests for the tracking-detail helpers (tasks 5.6/5.10). These close the
 * verify-5b W2 UNTESTED rendering behaviours: chronological timeline order,
 * amount-card shown only on `disponible`, and the pickup-branch fallback.
 */

function historyEntry(status: string, createdAt: string): PackageHistoryEntry {
  return { status, createdAt };
}

function pkg(overrides: Partial<PackageDetail>): PackageDetail {
  return {
    _id: 'p1',
    tracking: 'RB-000001',
    status: 'disponible',
    createdAt: '2026-08-01T10:00:00Z',
    history: [],
    ...overrides,
  } as PackageDetail;
}

describe('sortTimelineChronological', () => {
  it('orders newest-first backend history oldest -> newest (across statuses)', () => {
    const history = [
      historyEntry('entregado', '2026-08-05T09:00:00Z'),
      historyEntry('en_reparto', '2026-08-04T09:00:00Z'),
      historyEntry('disponible', '2026-08-03T09:00:00Z'),
      historyEntry('almacen_rd', '2026-08-02T09:00:00Z'),
      historyEntry('llego_rd', '2026-08-01T09:00:00Z'),
      historyEntry('en_transito', '2026-07-31T09:00:00Z'),
      historyEntry('almacen_miami', '2026-07-30T09:00:00Z'),
      historyEntry('recibido_miami', '2026-07-29T09:00:00Z'),
    ];

    const sorted = sortTimelineChronological(history);

    expect(sorted.map((e) => e.status)).toEqual([
      'recibido_miami',
      'almacen_miami',
      'en_transito',
      'llego_rd',
      'almacen_rd',
      'disponible',
      'en_reparto',
      'entregado',
    ]);
  });

  it('does not mutate the input array', () => {
    const history = [historyEntry('entregado', '2026-08-05T09:00:00Z'), historyEntry('recibido_miami', '2026-07-29T09:00:00Z')];
    sortTimelineChronological(history);
    expect(history[0].status).toBe('entregado');
  });
});

describe('shouldShowAmountCard', () => {
  it('shows the card when disponible and the amount is disclosed', () => {
    expect(shouldShowAmountCard(pkg({ status: 'disponible', amountToPay: 45.5 }))).toBe(true);
  });

  it('hides the card when the package is not disponible (e.g. en_reparto)', () => {
    expect(shouldShowAmountCard(pkg({ status: 'en_reparto', amountToPay: 45.5 }))).toBe(false);
    expect(shouldShowAmountCard(pkg({ status: 'entregado', amountToPay: 45.5 }))).toBe(false);
  });

  it('hides the card when disponible but no amount was disclosed', () => {
    expect(shouldShowAmountCard(pkg({ status: 'disponible', amountToPay: undefined }))).toBe(false);
  });
});

describe('pickupBranchOf', () => {
  it('prefers pickupBranch over branchId', () => {
    const detail = pkg({
      pickupBranch: { id: 'b1', name: 'Santo Domingo', address: 'Av. 27' },
      branchId: { _id: 'b2', name: 'Santiago', address: 'Calle 1' },
    });
    expect(pickupBranchOf(detail)).toEqual({ id: 'b1', name: 'Santo Domingo', address: 'Av. 27' });
  });

  it('falls back to branchId when pickupBranch is absent', () => {
    const detail = pkg({ pickupBranch: null, branchId: { _id: 'b2', name: 'Santiago', address: 'Calle 1' } });
    expect(pickupBranchOf(detail)).toEqual({ _id: 'b2', name: 'Santiago', address: 'Calle 1' });
  });

  it('returns null when neither branch is present', () => {
    expect(pickupBranchOf(pkg({ pickupBranch: null, branchId: null }))).toBeNull();
  });
});

describe('formatCurrency', () => {
  it('formats with the tenant currency from the API response', () => {
    expect(formatCurrency(45.5, 'USD')).toBe(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(45.5));
    expect(formatCurrency(45.5, 'USD')).toContain('45.50');
  });

  it('formats DOP amounts with the currency symbol/code, never a bare "$"', () => {
    const formatted = formatCurrency(1234.5, 'DOP');
    expect(formatted).toContain('1,234.50');
    // DOP must be distinguishable from USD (RD$ / DOP marker present)
    expect(formatted).toMatch(/RD\$|DOP/);
  });

  it('falls back to DOP when the response omits the currency', () => {
    expect(formatCurrency(10, undefined)).toBe(formatCurrency(10, 'DOP'));
  });
});
