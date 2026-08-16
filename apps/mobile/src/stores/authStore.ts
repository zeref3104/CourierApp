import { create } from 'zustand';
import * as authStorage from '@/lib/authStorage';

/**
 * Client profile returned by the auth endpoints. The login endpoint enriches
 * it with the company context (slug/name/prefix) so the tenant store can be
 * hydrated from the same response.
 */
export interface ClientProfile {
  id: string;
  code: string;
  name: string;
  email?: string;
  company?: {
    slug: string;
    name: string;
    prefix: string;
  };
}

export type AuthStatus = 'unknown' | 'restoring' | 'authenticated' | 'unauthenticated';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  client: ClientProfile | null;
  status: AuthStatus;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setClient: (client: ClientProfile) => void;
  clearAuth: () => Promise<void>;
  setStatus: (status: AuthStatus) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  client: null,
  status: 'unknown',

  /**
   * Persist a fresh token pair. The refresh token goes to the keychain (with
   * an AsyncStorage fallback); the access token lives only in memory (it is
   * short-lived and refreshed on demand — never persisted, matching the
   * spec's "access in memory, refresh in secure storage" split).
   *
   * The in-memory session is ALWAYS set: a storage failure must never strand
   * a user the server already authenticated (the register flow would bounce
   * to /login and the login flow would show a generic error). Worst case the
   * session survives until the access token expires / the app restarts.
   */
  setTokens: async (accessToken, refreshToken) => {
    try {
      await authStorage.saveRefreshToken(refreshToken);
    } catch (err) {
      console.warn('[auth] failed to persist refresh token; continuing with in-memory session', err);
    }
    set({ accessToken, refreshToken, status: 'authenticated' });
  },

  setClient: (client) => set({ client }),

  /** Full local wipe on logout or refresh failure (spec: "logout clears tenant"). */
  clearAuth: async () => {
    await authStorage.clearAllAuth();
    set({ accessToken: null, refreshToken: null, client: null, status: 'unauthenticated' });
  },

  setStatus: (status) => set({ status }),
}));