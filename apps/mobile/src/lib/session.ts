import { useEffect } from 'react';
import * as authStorage from '@/lib/authStorage';
import { useAuthStore, AuthStatus } from '@/stores/authStore';
import { useTenantStore, TenantContext } from '@/stores/tenantStore';
import { setI18nLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

/**
 * App boot sequence (design D15 + client-mobile-app spec "tenant survives
 * restart"). Runs exactly once before the router guards resolve:
 *  1. Restore the persisted tenant context (companySlug/prefix/clientId) so the
 *     x-tenant-slug header is correct without re-login.
 *  2. Apply the persisted user-selected language; without one the i18n layer
 *     falls back to the device language / spec default.
 *  3. If a refresh token exists in the keychain, restore the session to
 *     `authenticated` (status stays `unknown` until we know). We do NOT call
 *     the API here — the first request's 401 interceptor will transparently
 *     refresh. If no refresh token is stored, we are unauthenticated.
 *
 * The function resolves to a non-blocking status so the router guard can show
 * the correct screen immediately.
 */
export async function restoreSession(): Promise<AuthStatus> {
  // Defensive: this boot path must ALWAYS settle into a concrete status. A
  // failed/half-native-module (e.g. expo-secure-store not linked) must never
  // leave the app stuck on the boot spinner.
  try {
    const tenant = await authStorage.loadTenant<TenantContext>();
    useTenantStore.setState({ tenant, hydrated: true });
  } catch {
    // Corrupt or unavailable tenant storage -> never block the boot. The
    // interceptor defaults to no tenant slug, which is fine pre-login.
    useTenantStore.setState({ hydrated: true });
  }

  // Language restore is best-effort; failures keep the device/default locale.
  try {
    const lang = await authStorage.loadLanguage();
    if (lang && SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)) {
      setI18nLanguage(lang as SupportedLanguage);
    }
  } catch {
    // no-op: i18n already falls back to device/default language.
  }

  try {
    const refreshToken = await authStorage.loadRefreshToken();
    if (refreshToken) {
      // Token exists -> assume authenticated; interceptor handles expiry offline.
      useAuthStore.setState({ refreshToken, status: 'authenticated' });
      return 'authenticated';
    }
  } catch {
    // Keychain failed -> treat as logged out rather than blocking the app.
    useAuthStore.setState({ status: 'unauthenticated' });
    return 'unauthenticated';
  }

  useAuthStore.setState({ status: 'unauthenticated' });
  return 'unauthenticated';
}

/** React hook that restores the session once on mount and returns the status. */
export function useSessionBootstrap(): AuthStatus {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status === 'unknown') {
      // Never let an unhandled rejection leave the boot status stuck on
      // "unknown" (infinite spinner). Any failure degrades to logged-out.
      restoreSession().catch(() => {
        useAuthStore.setState({ status: 'unauthenticated' });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return status;
}