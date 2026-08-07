import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as authStorage from '@/lib/authStorage';
import { registerDeviceToken } from '@/api/clientNotifications';

/**
 * Expo push token registration (task 5.7, push-notifications spec).
 *
 * After login/register the authenticated area calls
 * `registerPushTokenForCurrentUser()` exactly once per session; the flow:
 *   1. request notification permission (skip silently if denied),
 *   2. obtain the Expo push token via `getExpoPushTokenAsync` (needs a
 *      projectId — resolved from EXPO_PUBLIC_EAS_PROJECT_ID, app.json
 *      `extra.eas.projectId` or eas.json; when absent in dev we skip),
 *   3. register it via POST /client/device-token (backend dedups by token and
 *      caps at 5 — idempotent re-registration is safe).
 *
 * "Exactly once per token" is enforced locally too: the last registered token
 * is persisted, and a token that did not change skips the API call entirely.
 * Every failure path is silent — the user is never shown an error for push
 * registration; a transient failure is retried on the next login/restore.
 */

export type PushRegistrationSkipReason = 'permission-denied' | 'no-project-id' | 'unsupported-platform';

export interface PushRegistrationResult {
  registered: boolean;
  token?: string;
  skippedReason?: PushRegistrationSkipReason;
}

/** The platform value the device-token endpoint accepts, or null (e.g. web). */
export function pushPlatform(os: string = Platform.OS): 'android' | 'ios' | null {
  return os === 'android' || os === 'ios' ? os : null;
}

export interface PushProjectSource {
  env: Record<string, string | undefined>;
  extra?: { eas?: { projectId?: string } } | null;
  easConfig?: { projectId?: string } | null;
}

/**
 * Resolve the EAS projectId required by `getExpoPushTokenAsync`. Priority:
 * EXPO_PUBLIC_EAS_PROJECT_ID env -> app.json `extra.eas.projectId` ->
 * eas.json projectId. Returns undefined (dev without EAS config) to skip.
 */
export function resolvePushProjectId(source: PushProjectSource): string | undefined {
  if (source.env.EXPO_PUBLIC_EAS_PROJECT_ID) return source.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (source.extra?.eas?.projectId) return source.extra.eas.projectId;
  if (source.easConfig?.projectId) return source.easConfig.projectId;
  return undefined;
}

export type TokenAcquisition =
  | { status: 'granted'; token: string }
  | { status: 'permission-denied' };

/** Ask for notification permission, then fetch the Expo push token. */
export async function acquireExpoPushToken(projectId: string): Promise<TokenAcquisition> {
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return { status: 'permission-denied' };
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return { status: 'granted', token: tokenData.data };
}

/** Single-flight lock so a re-render never double-registers the same session. */
let registrationInFlight: Promise<PushRegistrationResult> | null = null;

async function doRegisterPushToken(): Promise<PushRegistrationResult> {
  const platform = pushPlatform();
  if (!platform) return { registered: false, skippedReason: 'unsupported-platform' };

  const projectId = resolvePushProjectId({
    env: process.env,
    extra: Constants.expoConfig?.extra,
    easConfig: Constants.easConfig,
  });
  if (!projectId) return { registered: false, skippedReason: 'no-project-id' };

  try {
    const acquisition = await acquireExpoPushToken(projectId);
    if (acquisition.status !== 'granted') {
      return { registered: false, skippedReason: 'permission-denied' };
    }

    // Exactly once per token: skip the API call when the device token did not
    // change since the last successful registration.
    const stored = await authStorage.loadPushToken();
    if (stored === acquisition.token) {
      return { registered: true, token: acquisition.token };
    }

    await registerDeviceToken(acquisition.token, platform);
    await authStorage.savePushToken(acquisition.token);
    return { registered: true, token: acquisition.token };
  } catch {
    // Best-effort: a transient network/native failure must never surface to the
    // user or break the authenticated area. Retried on the next login/restore.
    return { registered: false };
  }
}

/**
 * Register the current device's push token (idempotent, silent on failure).
 * Deliberately NOT async: a plain function returns the SAME in-flight promise
 * to concurrent callers, so a re-render can never start a second registration.
 */
export function registerPushTokenForCurrentUser(): Promise<PushRegistrationResult> {
  if (registrationInFlight) return registrationInFlight;
  registrationInFlight = doRegisterPushToken();
  const onSettled = () => {
    registrationInFlight = null;
  };
  // doRegister never rejects, but settle the lock via then/then (not finally)
  // so no derived promise can carry an unhandled rejection.
  registrationInFlight.then(onSettled, onSettled);
  return registrationInFlight;
}
