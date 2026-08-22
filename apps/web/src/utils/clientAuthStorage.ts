/**
 * Web storage for the client-session refresh token.
 *
 * Staff/superadmin sessions rotate their refresh token through an HTTP-only
 * cookie, but client logins (POST /auth/client/login) return both tokens in
 * the response BODY — the web has no native secure store, so the refresh
 * token lives in localStorage. This mirrors the mobile app's established
 * pattern (apps/mobile authStorage falls back to localStorage on web).
 */
const CLIENT_REFRESH_TOKEN_KEY = '@courier/client-refresh-token';

export function saveClientRefreshToken(token: string): void {
  localStorage.setItem(CLIENT_REFRESH_TOKEN_KEY, token);
}

export function loadClientRefreshToken(): string | null {
  return localStorage.getItem(CLIENT_REFRESH_TOKEN_KEY);
}

export function clearClientRefreshToken(): void {
  localStorage.removeItem(CLIENT_REFRESH_TOKEN_KEY);
}
