import { useCallback, useReducer, useRef } from 'react';
import { fetchPackages, PackageSummary, PaginationMeta } from '@/api/clientPanel';

/**
 * Package list state machine (task 5.5 + verify-5b W1 hardening).
 *
 * The list keeps a `generation` counter that is bumped on EVERY filter change.
 * Every async result (first page, load-more page) carries the generation it was
 * STARTED under; the reducer drops any result whose generation no longer
 * matches the current one. This closes the race where an in-flight `loadMore`
 * for the OLD filter resolves AFTER a chip switch and appends stale items/meta
 * onto the NEW filter's list.
 *
 * Pure reducer + thin hook so the transitions are unit-testable without a
 * React renderer.
 */
export const PACKAGES_PAGE_SIZE = 20;

export interface PackagesListState {
  filter: string | undefined;
  items: PackageSummary[];
  meta: PaginationMeta | null;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  /** Bumped on every filter change; async results must match it to be applied. */
  generation: number;
}

export const initialPackagesListState: PackagesListState = {
  filter: undefined,
  items: [],
  meta: null,
  loading: true,
  loadingMore: false,
  error: false,
  generation: 0,
};

export type PackagesListAction =
  | { type: 'FILTER_CHANGED'; filter: string | undefined; generation: number }
  | { type: 'FIRST_LOAD_START'; generation: number }
  | { type: 'FIRST_LOAD_OK'; generation: number; items: PackageSummary[]; meta: PaginationMeta }
  | { type: 'FIRST_LOAD_ERROR'; generation: number }
  | { type: 'LOAD_MORE_START'; generation: number }
  | { type: 'LOAD_MORE_OK'; generation: number; items: PackageSummary[]; meta: PaginationMeta }
  | { type: 'LOAD_MORE_ERROR'; generation: number };

export function packagesListReducer(state: PackagesListState, action: PackagesListAction): PackagesListState {
  switch (action.type) {
    case 'FILTER_CHANGED':
      // Filter switch resets the list and bumps the generation; every in-flight
      // result started under an older generation becomes stale and is dropped.
      return {
        ...state,
        filter: action.filter,
        items: [],
        meta: null,
        loading: true,
        loadingMore: false,
        error: false,
        generation: action.generation,
      };

    case 'FIRST_LOAD_START':
      if (action.generation !== state.generation) return state;
      return { ...state, loading: true, error: false };

    case 'FIRST_LOAD_OK':
      if (action.generation !== state.generation) return state;
      return { ...state, items: action.items, meta: action.meta, loading: false, error: false };

    case 'FIRST_LOAD_ERROR':
      if (action.generation !== state.generation) return state;
      return { ...state, loading: false, error: true };

    case 'LOAD_MORE_START':
      // Belt-and-suspenders: the hook also pre-guards, but dropping a stale
      // START here guarantees `loadingMore` can never stick true after a switch.
      if (action.generation !== state.generation) return state;
      if (state.loadingMore || !state.meta || state.meta.page >= state.meta.totalPages) return state;
      return { ...state, loadingMore: true };

    case 'LOAD_MORE_OK':
      // THE race guard: a load-more page for an old filter (stale generation)
      // must never append onto the new filter's list.
      if (action.generation !== state.generation) return state;
      return { ...state, items: [...state.items, ...action.items], meta: action.meta, loadingMore: false };

    case 'LOAD_MORE_ERROR':
      if (action.generation !== state.generation) return state;
      return { ...state, loadingMore: false };

    default:
      return state;
  }
}

/**
 * Hook wrapping the reducer with the async fetch lifecycle. The generation ref
 * is the source of truth for "current filter epoch"; it is bumped in
 * `changeFilter` and captured when each fetch STARTS so late resolutions can be
 * detected as stale by the reducer.
 */
export function usePackagesList(limit: number = PACKAGES_PAGE_SIZE) {
  const [state, dispatch] = useReducer(packagesListReducer, initialPackagesListState);
  const generationRef = useRef(0);

  const changeFilter = useCallback((filter?: string) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    dispatch({ type: 'FILTER_CHANGED', filter, generation });
  }, []);

  const loadFirst = useCallback(
    async (filter?: string) => {
      const generation = generationRef.current;
      dispatch({ type: 'FIRST_LOAD_START', generation });
      try {
        const page = await fetchPackages({ status: filter, page: 1, limit });
        dispatch({ type: 'FIRST_LOAD_OK', generation, items: page.items, meta: page.meta });
      } catch {
        dispatch({ type: 'FIRST_LOAD_ERROR', generation });
      }
    },
    [limit],
  );

  const loadMore = useCallback(async () => {
    // Pre-guard with the freshest render's state (FlatList passes the latest
    // callback, so this closure's meta/filter are current).
    if (state.loadingMore || !state.meta || state.meta.page >= state.meta.totalPages) return;
    const generation = generationRef.current;
    dispatch({ type: 'LOAD_MORE_START', generation });
    try {
      const page = await fetchPackages({ status: state.filter, page: state.meta.page + 1, limit });
      dispatch({ type: 'LOAD_MORE_OK', generation, items: page.items, meta: page.meta });
    } catch {
      dispatch({ type: 'LOAD_MORE_ERROR', generation });
    }
  }, [state.filter, state.meta, state.loadingMore, limit]);

  return { state, changeFilter, loadFirst, loadMore };
}
