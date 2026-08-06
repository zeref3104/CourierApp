import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { makeRequestInterceptor, makeResponseInterceptor, ApiDeps, RETRIED } from '@/lib/api';

// `@/lib/api` pulls in the zustand stores, which import authStorage, which
// imports expo-secure-store and AsyncStorage (native modules with no real
// implementation under Jest). Mock them so the interceptor tests stay unit-scoped.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

/**
 * Focused unit tests for the axios request/response interceptors (task 5.2:
 * "refresh without cookies", "refresh failure logs out", tenant header
 * injection). The `request` re-issue is injected so no real network is hit, and
 * the refresh token travels in the request BODY (design D10).
 */

function buildDeps(overrides: Partial<ApiDeps> = {}): ApiDeps & { request: jest.Mock; clearAuth: jest.Mock } {
  return {
    getAccessToken: () => 'access-1',
    getRefreshToken: () => 'refresh-1',
    getTenantSlug: () => 'rapid-box',
    saveTokens: jest.fn(async () => {}),
    clearAuth: jest.fn(async () => {}),
    postRefresh: jest.fn(async () => ({ accessToken: 'access-2', refreshToken: 'refresh-2' })),
    request: jest.fn(async () => ({ data: {} })),
    ...overrides,
  } as ApiDeps & { request: jest.Mock; clearAuth: jest.Mock };
}

function reqConfig(headers: Record<string, string> = {}): InternalAxiosRequestConfig {
  const h = new AxiosHeaders();
  Object.entries(headers).forEach(([k, v]) => h.set(k, v));
  return { url: '/customer/dashboard', method: 'get', headers: h } as InternalAxiosRequestConfig;
}

function error401(config: InternalAxiosRequestConfig): AxiosError {
  return {
    config,
    response: { status: 401, data: {}, statusText: 'Unauthorized', headers: {} },
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Request failed with status code 401',
  } as unknown as AxiosError;
}

function error500(config: InternalAxiosRequestConfig): AxiosError {
  return {
    config,
    response: { status: 500, data: {}, statusText: 'Server Error', headers: {} },
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Request failed with status code 500',
  } as unknown as AxiosError;
}

describe('request interceptor', () => {
  it('injects Authorization Bearer + x-tenant-slug', () => {
    const config = makeRequestInterceptor(buildDeps())(reqConfig());
    expect(config.headers.get('Authorization')).toBe('Bearer access-1');
    expect(config.headers.get('x-tenant-slug')).toBe('rapid-box');
  });

  it('does not overwrite an existing Authorization header', () => {
    const config = makeRequestInterceptor(buildDeps())(reqConfig({ Authorization: 'Bearer provided' }));
    expect(config.headers.get('Authorization')).toBe('Bearer provided');
  });

  it('omits headers when no token/slug are available', () => {
    const handler = makeRequestInterceptor(buildDeps({ getAccessToken: () => null, getTenantSlug: () => null }));
    const config = handler(reqConfig());
    expect(config.headers.has('Authorization')).toBe(false);
    expect(config.headers.has('x-tenant-slug')).toBe(false);
  });
});

describe('response interceptor', () => {
  it('passes non-401 errors through untouched', async () => {
    const d = buildDeps();
    const err = error500(reqConfig());
    await expect(makeResponseInterceptor(d)(err)).rejects.toBe(err);
    expect(d.postRefresh).not.toHaveBeenCalled();
    expect(d.clearAuth).not.toHaveBeenCalled();
  });

  it('refreshes via the body endpoint (no cookies) and retries the original request', async () => {
    const d = buildDeps();
    const original = reqConfig();
    const result = await makeResponseInterceptor(d)(error401(original));

    expect(d.postRefresh).toHaveBeenCalledWith('refresh-1');
    expect(d.saveTokens).toHaveBeenCalledWith('access-2', 'refresh-2');
    expect(d.request).toHaveBeenCalledTimes(1);
    const retried = d.request.mock.calls[0][0] as InternalAxiosRequestConfig;
    expect(retried.url).toBe('/customer/dashboard');
    expect(retried.headers.Authorization).toBe('Bearer access-2');
    expect(result).toBeDefined();
  });

  it('logs out (clearAuth) when refresh fails', async () => {
    const d = buildDeps({
      postRefresh: jest.fn(async () => {
        throw new Error('revoked');
      }),
    });
    await expect(makeResponseInterceptor(d)(error401(reqConfig()))).rejects.toThrow('revoked');
    expect(d.clearAuth).toHaveBeenCalledTimes(1);
    expect(d.request).not.toHaveBeenCalled();
  });

  it('logs out when no refresh token is stored', async () => {
    const d = buildDeps({ getRefreshToken: () => null });
    await expect(makeResponseInterceptor(d)(error401(reqConfig()))).rejects.toBeDefined();
    expect(d.clearAuth).toHaveBeenCalledTimes(1);
    expect(d.request).not.toHaveBeenCalled();
  });

  it('does not refresh the same request more than once', async () => {
    const d = buildDeps();
    const original = reqConfig();
    // Simulate a config the interceptor has already retried, using the SAME
    // unique symbol the interceptor marks configs with.
    Object.defineProperty(original, RETRIED, { value: true, enumerable: false });

    const err = error401(original);
    await expect(makeResponseInterceptor(d)(err)).rejects.toBe(err);
    expect(d.postRefresh).not.toHaveBeenCalled();
    expect(d.request).not.toHaveBeenCalled();
  });
});