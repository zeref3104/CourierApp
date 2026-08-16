import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * expo-secure-store is a native-only module (Keychain / Keystore). On web the
 * official Expo pattern is localStorage as the fallback backend (see
 * expo-secure-store docs: "not available on the web"). We branch on the
 * platform so the refresh token persists on every target the app runs on.
 */
const isWeb = Platform.OS === 'web' || process.env.EXPO_OS === 'web';

/**
 * Key space used to namespace secure storage keys. Keeping a single namespace
 * avoids collisions with any future feature that writes to SecureStore and keeps
 * the logout wipe list trivial to enumerate.
 */
export const SECURE_KEYS = {
  refreshToken: '@courier/refresh-token',
} as const;

export const ASYNC_KEYS = {
  tenant: '@courier/tenant',
  // Last successfully-registered Expo push token. Kept so re-registration is
  // skipped when the device token did not change ("register exactly once per
  // token", task 5.7); the backend dedups anyway.
  pushToken: '@courier/push-token',
  // User-selected app language, persisted so the choice survives restarts.
  language: '@courier/language',
} as const;

/**
 * Persist the client refresh token in the OS keychain (expo-secure-store).
 * React Native has no HTTP-only cookie jar (design D10), so the refresh token
 * must live outside the JS bundle and survive app restarts in a guard it can
 * read back on boot.
 *
 * Resilience: on some Android devices the Keystore key behind SecureStore can
 * become permanently unusable (stale encrypted entry from a previous install,
 * or a device Keystore hiccup) and setItemAsync starts throwing
 * EncryptException/WriteException. Without a fallback that would block login
 * and registration entirely — the register flow bounces to /login and the
 * login flow shows a generic error even though the server authenticated the
 * user. We therefore fall back to AsyncStorage (app-sandboxed, same file
 * storage family) so the session keeps working; SecureStore stays the
 * preferred backend and is retried on every write/read.
 */
export async function saveRefreshToken(token: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(SECURE_KEYS.refreshToken, token);
    return;
  }
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.refreshToken, token);
  } catch {
    await AsyncStorage.setItem(SECURE_KEYS.refreshToken, token);
  }
}

/** Read the stored refresh token, or null when absent/corrupt. */
export async function loadRefreshToken(): Promise<string | null> {
  if (isWeb) {
    return localStorage.getItem(SECURE_KEYS.refreshToken);
  }
  try {
    const secure = await SecureStore.getItemAsync(SECURE_KEYS.refreshToken);
    if (secure !== null) return secure;
  } catch {
    // SecureStore read failed (e.g. undecryptable entry from a previous
    // install) — fall through to the AsyncStorage fallback copy.
  }
  return AsyncStorage.getItem(SECURE_KEYS.refreshToken);
}

/** Delete the stored refresh token (logout / refresh failure). */
export async function clearRefreshToken(): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(SECURE_KEYS.refreshToken);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.refreshToken);
  } catch {
    // A broken SecureStore entry must not block the logout wipe; the
    // AsyncStorage fallback copy below is what keeps the state consistent.
  }
  await AsyncStorage.removeItem(SECURE_KEYS.refreshToken);
}

/**
 * Persist the tenant context. Lives in AsyncStorage (not the keychain) because
 * it is not a secret — companyId/companySlug/companyPrefix/clientId are safe to
 * survive restarts and must be restored so the app picks the correct
 * x-tenant-slug header without a fresh login (client-mobile-app spec:
 * "tenant survives restart").
 */
export async function saveTenant<T extends object>(context: T): Promise<void> {
  await AsyncStorage.setItem(ASYNC_KEYS.tenant, JSON.stringify(context));
}

/** Read and parse the stored tenant context, or null when absent/invalid. */
export async function loadTenant<T>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(ASYNC_KEYS.tenant);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt payload (e.g. an aborted write). Discard so a stale half-write
    // never masquerades as valid tenant context.
    await AsyncStorage.removeItem(ASYNC_KEYS.tenant);
    return null;
  }
}

/** Clear the tenant context (logout). */
export async function clearTenant(): Promise<void> {
  await AsyncStorage.removeItem(ASYNC_KEYS.tenant);
}

/** Persist the last registered Expo push token (AsyncStorage — not a secret). */
export async function savePushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(ASYNC_KEYS.pushToken, token);
}

/** Read the last registered Expo push token, or null when never registered. */
export async function loadPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(ASYNC_KEYS.pushToken);
}

/**
 * Clear the last registered Expo push token. Called on logout so a different
 * user signing in on the SAME device re-registers its own push token (the
 * once-per-token skip would otherwise suppress registration for the new user).
 */
export async function clearPushToken(): Promise<void> {
  await AsyncStorage.removeItem(ASYNC_KEYS.pushToken);
}

/** Persist the user-selected app language (e.g. 'en'). Not a secret. */
export async function saveLanguage(language: string): Promise<void> {
  await AsyncStorage.setItem(ASYNC_KEYS.language, language);
}

/** Read the persisted app language, or null when the user never chose one. */
export async function loadLanguage(): Promise<string | null> {
  return AsyncStorage.getItem(ASYNC_KEYS.language);
}

/** Nuke every locally persisted auth/tenant value in one shot (logout). */
export async function clearAllAuth(): Promise<void> {
  await Promise.all([clearRefreshToken(), clearTenant(), clearPushToken()]);
}