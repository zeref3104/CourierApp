import { restoreSession } from '../session';
import { useAuthStore, AuthStatus } from '@/stores/authStore';
import { useTenantStore } from '@/stores/tenantStore';
import { TenantContext } from '@/stores/tenantStore';

jest.mock('@/lib/authStorage', () => ({
  saveRefreshToken: jest.fn(async () => {}),
  loadRefreshToken: jest.fn(async () => null),
  clearRefreshToken: jest.fn(async () => {}),
  loadTenant: jest.fn(async () => null),
  saveTenant: jest.fn(async () => {}),
  clearTenant: jest.fn(async () => {}),
  clearAllAuth: jest.fn(async () => {}),
}));

import * as authStorage from '@/lib/authStorage';

const tenant: TenantContext = {
  companyId: 'comp-1',
  companySlug: 'rapid-box',
  companyPrefix: 'RB',
  clientId: 'c1',
};

describe('restoreSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ accessToken: null, refreshToken: null, client: null, status: 'unknown' as AuthStatus });
    useTenantStore.setState({ tenant: null, hydrated: false });
  });

  it('restores the tenant context and treats a stored refresh token as authenticated', async () => {
    (authStorage.loadTenant as jest.Mock).mockResolvedValueOnce(tenant);
    (authStorage.loadRefreshToken as jest.Mock).mockResolvedValueOnce('refresh-1');

    const status = await restoreSession();
    expect(status).toBe('authenticated');
    expect(useTenantStore.getState().tenant).toEqual(tenant);
    expect(useTenantStore.getState().hydrated).toBe(true);
    expect(useAuthStore.getState().refreshToken).toBe('refresh-1');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('is unauthenticated when no refresh token is stored', async () => {
    (authStorage.loadTenant as jest.Mock).mockResolvedValueOnce(null);
    (authStorage.loadRefreshToken as jest.Mock).mockResolvedValueOnce(null);

    const status = await restoreSession();
    expect(status).toBe('unauthenticated');
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});