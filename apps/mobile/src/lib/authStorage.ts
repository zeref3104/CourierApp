import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
} as const;

/**
 * Persist the client refresh token in the OS keychain (expo-secure-store).
 * React Native has no HTTP-only cookie jar (design D10), so the refresh token
 * must live outside the JS bundle and survive app restarts in a guard it can
 * read back on boot.
 */
export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEYS.refreshToken, token);
}

/** Read the stored refresh token, or null when absent/corrupt. */
export async function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_KEYS.refreshToken);
}

/** Delete the stored refresh token (logout / refresh failure). */
export async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEYS.refreshToken);
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

/** Nuke every locally persisted auth/tenant value in one shot (logout). */
export async function clearAllAuth(): Promise<void> {
  await Promise.all([clearRefreshToken(), clearTenant()]);
}