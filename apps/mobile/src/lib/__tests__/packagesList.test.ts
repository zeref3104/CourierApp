import {
  packagesListReducer,
  initialPackagesListState,
  PackagesListState,
} from '@/lib/packagesList';
import { PackageSummary, PaginationMeta } from '@/api/clientPanel';

// The reducer is pure; mock the API module it imports so no native storage
// modules (AsyncStorage/secure-store pulled by the api client) load under jest.
jest.mock('@/api/clientPanel', () => ({
  fetchPackages: jest.fn(),
}));

/**
 * Unit tests for the package-list state machine (tasks 5.5/5.10 + verify-5b W1).
 * The generation guard is the behaviour under test: an in-flight page fetch for
 * an OLD filter must never mutate the list after a chip switch.
 */

function pkg(id: string, tracking = `RB-${id}`): PackageSummary {
  return { _id: id, tracking, status: 'disponible', createdAt: '2026-08-01T10:00:00Z' };
}

function meta(page: number, totalPages = 3): PaginationMeta {
  return { page, limit: 20, total: totalPages * 20, totalPages };
}

describe('packagesListReducer', () => {
  it('FILTER_CHANGED resets the list, bumps the generation and shows the loader', () => {
    const before: PackagesListState = {
      ...initialPackagesListState,
      items: [pkg('p1')],
      meta: meta(1),
      loading: false,
      loadingMore: true,
      generation: 1,
    };

    const next = packagesListReducer(before, { type: 'FILTER_CHANGED', filter: 'disponible', generation: 2 });

    expect(next.filter).toBe('disponible');
    expect(next.items).toEqual([]);
    expect(next.meta).toBeNull();
    expect(next.loading).toBe(true);
    expect(next.loadingMore).toBe(false);
    expect(next.error).toBe(false);
    expect(next.generation).toBe(2);
  });

  it('FIRST_LOAD_OK with the current generation replaces items and meta', () => {
    const next = packagesListReducer(initialPackagesListState, {
      type: 'FIRST_LOAD_OK',
      generation: 0,
      items: [pkg('p1')],
      meta: meta(1),
    });

    expect(next.loading).toBe(false);
    expect(next.error).toBe(false);
    expect(next.items).toEqual([pkg('p1')]);
    expect(next.meta).toEqual(meta(1));
  });

  it('FIRST_LOAD_OK with a stale generation is ignored (in-flight old-filter load)', () => {
    // State after the user switched to a new filter (generation bumped to 2).
    const current: PackagesListState = {
      ...initialPackagesListState,
      filter: 'disponible',
      loading: true,
      generation: 2,
    };

    // A first-page load started under generation 1 (the OLD filter) resolves late.
    const next = packagesListReducer(current, {
      type: 'FIRST_LOAD_OK',
      generation: 1,
      items: [pkg('stale')],
      meta: meta(1),
    });

    expect(next.items).toEqual([]);
    expect(next.loading).toBe(true); // the new filter's load still in flight
    expect(next.generation).toBe(2);
  });

  it('FIRST_LOAD_ERROR with a stale generation does not flag the new filter as failed', () => {
    const current: PackagesListState = { ...initialPackagesListState, generation: 2, loading: true };
    const next = packagesListReducer(current, { type: 'FIRST_LOAD_ERROR', generation: 1 });
    expect(next.error).toBe(false);
    expect(next.loading).toBe(true);
  });

  it('LOAD_MORE_START is refused past the last page or with no meta', () => {
    const atLastPage: PackagesListState = { ...initialPackagesListState, meta: meta(3, 3), loading: false };
    expect(
      packagesListReducer(atLastPage, { type: 'LOAD_MORE_START', generation: 0 }).loadingMore,
    ).toBe(false);

    const noMeta: PackagesListState = { ...initialPackagesListState, loading: false };
    expect(
      packagesListReducer(noMeta, { type: 'LOAD_MORE_START', generation: 0 }).loadingMore,
    ).toBe(false);
  });

  it('LOAD_MORE_OK with the current generation appends items and updates meta', () => {
    const current: PackagesListState = {
      ...initialPackagesListState,
      items: [pkg('p1')],
      meta: meta(1),
      loadingMore: true,
      loading: false,
    };

    const next = packagesListReducer(current, {
      type: 'LOAD_MORE_OK',
      generation: 0,
      items: [pkg('p2')],
      meta: meta(2),
    });

    expect(next.items).toEqual([pkg('p1'), pkg('p2')]);
    expect(next.meta).toEqual(meta(2));
    expect(next.loadingMore).toBe(false);
  });

  it('LOAD_MORE_OK with a stale generation DROPS the append (verify-5b W1 race)', () => {
    // User is on the NEW filter (generation 2); a loadMore started under the
    // OLD filter (generation 1) resolves late with stale items + stale meta.
    const current: PackagesListState = {
      ...initialPackagesListState,
      filter: 'entregado',
      items: [pkg('new-p1')],
      meta: meta(1),
      loading: false,
      generation: 2,
    };

    const next = packagesListReducer(current, {
      type: 'LOAD_MORE_OK',
      generation: 1,
      items: [pkg('stale-p2', 'RB-STALE')],
      meta: meta(2),
    });

    expect(next.items).toEqual([pkg('new-p1')]); // nothing stale appended
    expect(next.meta).toEqual(meta(1)); // stale meta never overwrites the new filter's meta
    expect(next.loadingMore).toBe(false);
  });

  it('LOAD_MORE_START with a stale generation never sticks loadingMore on', () => {
    const current: PackagesListState = {
      ...initialPackagesListState,
      filter: 'disponible',
      items: [],
      meta: null,
      loading: true,
      generation: 2,
    };

    const next = packagesListReducer(current, { type: 'LOAD_MORE_START', generation: 1 });
    expect(next.loadingMore).toBe(false);
    expect(next.generation).toBe(2);
  });

  it('LOAD_MORE_ERROR with a stale generation leaves loadingMore false', () => {
    const current: PackagesListState = { ...initialPackagesListState, loadingMore: true, generation: 2 };
    const next = packagesListReducer(current, { type: 'LOAD_MORE_ERROR', generation: 1 });
    expect(next.loadingMore).toBe(true); // state untouched — stale action dropped
  });
});
