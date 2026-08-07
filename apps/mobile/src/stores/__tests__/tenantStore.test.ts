import { useTenantStore, TenantContext } from '../tenantStore';

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

describe('tenantStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTenantStore.setState({ tenant: null, hydrated: false });
  });

  it('setTenant persists to AsyncStorage and stores in state', async () => {
    await useTenantStore.getState().setTenant(tenant);
    expect(authStorage.saveTenant).toHaveBeenCalledWith(tenant);
    expect(useTenantStore.getState().tenant).toEqual(tenant);
  });

  it('restoreTenantFromStorage hydrates the tenant context', async () => {
    (authStorage.loadTenant as jest.Mock).mockResolvedValueOnce(tenant);
    await useTenantStore.getState().restoreTenantFromStorage();
    expect(useTenantStore.getState().tenant).toEqual(tenant);
    expect(useTenantStore.getState().hydrated).toBe(true);
  });

  it('restoreTenantFromStorage with no stored value keeps tenant null but marks hydrated', async () => {
    (authStorage.loadTenant as jest.Mock).mockResolvedValueOnce(null);
    await useTenantStore.getState().restoreTenantFromStorage();
    expect(useTenantStore.getState().tenant).toBeNull();
    expect(useTenantStore.getState().hydrated).toBe(true);
  });

  it('clearTenant clears storage and state', async () => {
    await useTenantStore.getState().setTenant(tenant);
    await useTenantStore.getState().clearTenant();
    expect(authStorage.clearTenant).toHaveBeenCalled();
    expect(useTenantStore.getState().tenant).toBeNull();
  });
});