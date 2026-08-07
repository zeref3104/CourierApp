import { useAuthStore, AuthStatus } from '../authStore';

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

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      client: null,
      status: 'unknown' as AuthStatus,
    });
  });

  it('setTokens persists the refresh token to secure storage and flips status', async () => {
    await useAuthStore.getState().setTokens('access-1', 'refresh-1');
    expect(authStorage.saveRefreshToken).toHaveBeenCalledWith('refresh-1');
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-1');
    expect(state.refreshToken).toBe('refresh-1');
    expect(state.status).toBe('authenticated');
  });

  it('setClient stores the client profile', () => {
    const client = { id: 'c1', code: 'RB-000001', name: 'Ada Lovelace' };
    useAuthStore.getState().setClient(client);
    expect(useAuthStore.getState().client).toBe(client);
  });

  it('clearAuth wipes every local value and returns to unauthenticated', async () => {
    await useAuthStore.getState().setTokens('access-1', 'refresh-1');
    await useAuthStore.getState().clearAuth();

    expect(authStorage.clearAllAuth).toHaveBeenCalled();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.client).toBeNull();
    expect(state.status).toBe('unauthenticated');
  });

  it('status transitions from unknown to authenticated on setTokens', async () => {
    expect(useAuthStore.getState().status).toBe('unknown');
    await useAuthStore.getState().setTokens('a', 'r');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });
});