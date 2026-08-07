import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';

/**
 * Single base URL for every request (design D16). Code login has no company
 * selector pre-auth, so a per-tenant base URL is a chicken-and-egg problem —
 * the API resolves the tenant server-side from the code, and the
 * `x-tenant-slug` header is only needed for tenant-scoped `/client/*` calls
 * after login. Set via EXPO_PUBLIC_API_URL (Expo inlines PUBLIC_* env at build).
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const REFRESH_ENDPOINT = '/auth/client/refresh';

/** Marks an original request config that has already been retried after a refresh. */
export const RETRIED: unique symbol = Symbol('refresh-retried');

export interface ApiDeps {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  getTenantSlug: () => string | null;
  /** Persist the token pair returned by a successful body refresh. */
  saveTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  /** Full local wipe after a failed refresh (spec: refresh failure logs out). */
  clearAuth: () => Promise<void>;
  /** POST /auth/client/refresh with the token in the BODY, no cookies (design D10). */
  postRefresh: (refreshToken: string) => Promise<{ accessToken: string; refreshToken: string }>;
  /**
   * Re-issue the original request after a successful refresh. Defaults to the
   * imported axios singleton; injected in tests so no real network is hit.
   */
  request?: <T = unknown>(config: AxiosRequestConfig) => Promise<{ data: T }>;
}

/**
 * Build the request interceptor handler. Injects Authorization: Bearer and the
 * x-tenant-slug header on every outbound request when available.
 */
export function makeRequestInterceptor(deps: ApiDeps) {
  return (config: InternalAxiosRequestConfig) => {
    const accessToken = deps.getAccessToken();
    if (accessToken && !config.headers.has('Authorization')) {
      config.headers.set('Authorization', `Bearer ${accessToken}`);
    }
    const tenantSlug = deps.getTenantSlug();
    if (tenantSlug && !config.headers.has('x-tenant-slug')) {
      config.headers.set('x-tenant-slug', tenantSlug);
    }
    return config;
  };
}

/**
 * Build the response interceptor. On a 401 it:
 *   1. fires the body-refresh endpoint with the stored refresh token,
 *   2. persists the rotated pair via saveTokens,
 *   3. retries the ORIGINAL request with the new access token, and
 *   4. on refresh failure calls clearAuth (logs the user out) and rejects.
 * Requests that are NOT 401 pass through untouched; a config is only retried
 * once (the RETRIED marker prevents an infinite loop).
 *
 * Concurrent 401s are DEDUPLICATED via a single-flight lock: while a refresh is
 * in flight, every other 401 awaits the SAME refresh promise instead of firing
 * its own POST /auth/client/refresh. Without this the dashboard's four parallel
 * /client/* calls would each rotate the token; the API revokes ALL client
 * tokens on a replay/rotation collision, which would spurious-logout the user.
 */
export function makeResponseInterceptor(deps: ApiDeps) {
  /** Single-flight lock: the in-flight refresh promise, or null when idle. */
  let refreshInFlight: Promise<{ accessToken: string; refreshToken: string }> | null = null;

  return async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { [RETRIED]?: boolean }) | undefined;

    const isRetryable401 = original && error.response?.status === 401 && !original[RETRIED];
    if (!isRetryable401) {
      return Promise.reject(error);
    }

    const refreshToken = deps.getRefreshToken();
    if (!refreshToken) {
      await deps.clearAuth();
      return Promise.reject(error);
    }

    try {
      if (!refreshInFlight) {
        // Single-flight: only the FIRST concurrent 401 actually calls refresh.
        refreshInFlight = deps.postRefresh(refreshToken);
        // Reset the lock when the shared refresh settles (success or failure)
        // so a later, legitimately new 401 starts a fresh refresh. Use
        // then(onSettled, onSettled) instead of finally(): the promise derived
        // by finally() would reject on refresh failure and crash the process
        // with an unhandled rejection.
        const onSettled = () => {
          refreshInFlight = null;
        };
        refreshInFlight.then(onSettled, onSettled);
      }
      const next = await refreshInFlight;
      await deps.saveTokens(next.accessToken, next.refreshToken);
      // Retry the original request with the fresh access token.
      original.headers = { ...original.headers, Authorization: `Bearer ${next.accessToken}` };
      original[RETRIED] = true;
      const requester = deps.request ?? axios.request;
      // Re-issue the exact same request config against this client.
      return requester(original);
    } catch (refreshError) {
      await deps.clearAuth();
      return Promise.reject(refreshError);
    }
  };
}

/** Assemble a fully-wired axios client from the injected dependencies. */
export function createApiClient(deps: ApiDeps, baseURL: string = API_BASE_URL): AxiosInstance {
  const api = axios.create({ baseURL, timeout: 15000 });
  api.interceptors.request.use(makeRequestInterceptor(deps));
  api.interceptors.response.use(undefined, makeResponseInterceptor(deps));
  return api;
}

// --- Production singleton wired to the zustand stores -------------------------

/** POST /auth/client/refresh — refresh token in body, no HTTP-only cookie. */
async function postBodyRefresh(refreshToken: string) {
  const raw = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
  const { data } = await raw.post<{ data: { accessToken: string; refreshToken: string } }>(REFRESH_ENDPOINT, {
    refreshToken,
  });
  return data.data;
}

const storeDeps: ApiDeps = {
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  getTenantSlug: () => useTenantStore.getState().tenant?.companySlug ?? null,
  saveTokens: (accessToken, refreshToken) => useAuthStore.getState().setTokens(accessToken, refreshToken),
  clearAuth: () => useAuthStore.getState().clearAuth(),
  postRefresh: postBodyRefresh,
};

/** Shared authed client used by the app (base URL from EXPO_PUBLIC_API_URL). */
export const api = createApiClient(storeDeps);