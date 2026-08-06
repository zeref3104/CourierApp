import { useEffect } from 'react';
import * as authStorage from '@/lib/authStorage';
import { useAuthStore, AuthStatus } from '@/stores/authStore';
import { useTenantStore, TenantContext } from '@/stores/tenantStore';

/**
 * App boot sequence (design D15 + client-mobile-app spec "tenant survives
 * restart"). Runs exactly once before the router guards resolve:
 *  1. Restore the persisted tenant context (companySlug/prefix/clientId) so the
 *     x-tenant-slug header is correct without re-login.
 *  2. If a refresh token exists in the keychain, restore the session to
 *     `authenticated` (status stays `unknown` until we know). We do NOT call
 *     the API here — the first request's 401 interceptor will transparently
 *     refresh. If no refresh token is stored, we are unauthenticated.
 *
 * The function resolves to a non-blocking status so the router guard can show
 * the correct screen immediately.
 */
export async function restoreSession(): Promise<AuthStatus> {
  const tenant = await authStorage.loadTenant<TenantContext>();
  if (tenant) {
    useTenantStore.setState({ tenant, hydrated: true });
  } else {
    useTenantStore.setState({ hydrated: true });
  }

  const refreshToken = await authStorage.loadRefreshToken();
  if (refreshToken) {
    // Token exists -> assume authenticated; interceptor handles expiry offline.
    useAuthStore.setState({ refreshToken, status: 'authenticated' });
    return 'authenticated';
  }

  useAuthStore.setState({ status: 'unauthenticated' });
  return 'unauthenticated';
}

/** React hook that restores the session once on mount and returns the status. */
export function useSessionBootstrap(): AuthStatus {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status === 'unknown') {
      restoreSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return status;
}