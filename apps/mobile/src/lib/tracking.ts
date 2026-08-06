import { PackageDetail, PackageHistoryEntry, PickupBranch } from '@/api/clientPanel';

/**
 * Pure helpers for the tracking detail screen (client-panel-specs delta,
 * tasks 5.6/5.10). Extracted so the verify-5b UNTESTED rendering behaviours —
 * chronological timeline order, amount-card gating — are unit-testable.
 */

/** Backend returns history newest-first; the spec timeline is chronological. */
export function sortTimelineChronological(history: PackageHistoryEntry[]): PackageHistoryEntry[] {
  return [...history].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

/**
 * Amount-to-pay card gate: shown ONLY when the package is `disponible` AND the
 * backend actually disclosed an amount (for any other status it strips the
 * amount-bearing fields, and we must not render a card).
 */
export function shouldShowAmountCard(
  pkg: Pick<PackageDetail, 'status' | 'amountToPay'>,
): boolean {
  return pkg.status === 'disponible' && typeof pkg.amountToPay === 'number';
}

/** Pickup branch for the amount card: prefer pickupBranch, fall back to branchId. */
export function pickupBranchOf(pkg: PackageDetail): PickupBranch | { name: string; address?: string } | null {
  return pkg.pickupBranch ?? pkg.branchId ?? null;
}
