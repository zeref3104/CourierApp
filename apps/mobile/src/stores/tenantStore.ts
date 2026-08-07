import { create } from 'zustand';
import * as authStorage from '@/lib/authStorage';

/**
 * Tenant context recovered from the login/register response and persisted so
 * the app survives restarts without re-login (client-mobile-app spec). The
 * `companySlug` drives the `x-tenant-slug` header on every /client/* call; the
 * code prefix and client id are used for display and profile reads.
 */
export interface TenantContext {
  companyId: string;
  companySlug: string;
  companyPrefix: string;
  clientId: string;
}

interface TenantState {
  tenant: TenantContext | null;
  hydrated: boolean;
  restoreTenantFromStorage: () => Promise<void>;
  setTenant: (tenant: TenantContext) => Promise<void>;
  clearTenant: () => Promise<void>;
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  hydrated: false,

  /** Restore the tenant context from AsyncStorage on app boot. */
  restoreTenantFromStorage: async () => {
    const tenant = await authStorage.loadTenant<TenantContext>();
    set({ tenant, hydrated: true });
  },

  setTenant: async (tenant) => {
    await authStorage.saveTenant(tenant);
    set({ tenant });
  },

  clearTenant: async () => {
    await authStorage.clearTenant();
    set({ tenant: null });
  },
}));