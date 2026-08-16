import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearAllAuth,
  clearPushToken,
  loadLanguage,
  loadPushToken,
  saveLanguage,
  savePushToken,
  saveRefreshToken,
  loadRefreshToken,
  SECURE_KEYS,
  ASYNC_KEYS,
} from '@/lib/authStorage';

// Native modules have no implementation under Jest — mock them like the other
// app tests do (see api.test.ts), backed by an in-memory map so the
// save/load/clear round-trip is real. The `mock` prefix is required for Jest
// to let the module factory reference it.
const mockMemory = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockMemory.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockMemory.delete(key);
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockMemory.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockMemory.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockMemory.delete(key);
  }),
  clear: jest.fn(async () => {
    mockMemory.clear();
  }),
}));

/**
 * authStorage contract tests (W2 hardening): the logout wipe must clear the
 * last-registered push token too, so a DIFFERENT user signing in on the same
 * device re-registers its own device token (the once-per-token skip would
 * otherwise suppress registration for the new user).
 */
describe('authStorage push token lifecycle', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockMemory.clear();
  });

  it('savePushToken/loadPushToken round-trips the last registered token', async () => {
    await savePushToken('ExponentPushToken[abc]');
    await expect(loadPushToken()).resolves.toBe('ExponentPushToken[abc]');
  });

  it('clearPushToken removes the stored token', async () => {
    await savePushToken('ExponentPushToken[abc]');
    await clearPushToken();
    await expect(loadPushToken()).resolves.toBeNull();
  });

  it('clearAllAuth (logout) wipes refresh token, tenant AND push token', async () => {
    await savePushToken('ExponentPushToken[abc]');

    await clearAllAuth();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(SECURE_KEYS.refreshToken);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(ASYNC_KEYS.tenant);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(ASYNC_KEYS.pushToken);
    await expect(loadPushToken()).resolves.toBeNull();
  });
});

describe('authStorage refresh-token fallback (Android Keystore failure)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockMemory.clear();
  });

  it('falls back to AsyncStorage when SecureStore.setItemAsync throws', async () => {
    // Simulate a broken Keystore (stale encrypted entry / device hiccup): the
    // native write rejects and must NOT block saving the refresh token.
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Keystore operation failed'));

    await saveRefreshToken('rt-fallback');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(SECURE_KEYS.refreshToken, 'rt-fallback');
    await expect(loadRefreshToken()).resolves.toBe('rt-fallback');
  });

  it('returns the AsyncStorage copy when SecureStore.getItemAsync throws', async () => {
    await AsyncStorage.setItem(SECURE_KEYS.refreshToken, 'rt-securecopy');

    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('Could not decrypt'));

    await expect(loadRefreshToken()).resolves.toBe('rt-securecopy');
  });

  it('clearRefreshToken removes the AsyncStorage fallback copy too', async () => {
    await AsyncStorage.setItem(SECURE_KEYS.refreshToken, 'rt-clear');

    (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('broken keystore'));

    await clearAllAuth();

    await expect(AsyncStorage.getItem(SECURE_KEYS.refreshToken)).resolves.toBeNull();
  });
});

describe('authStorage language lifecycle', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockMemory.clear();
  });

  it('saveLanguage/loadLanguage round-trips the chosen app language', async () => {
    await saveLanguage('en');
    await expect(loadLanguage()).resolves.toBe('en');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(ASYNC_KEYS.language, 'en');
  });

  it('returns null when no language was ever chosen', async () => {
    await expect(loadLanguage()).resolves.toBeNull();
  });
});
