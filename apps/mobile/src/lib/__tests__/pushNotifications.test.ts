import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerDeviceToken } from '@/api/clientNotifications';
import {
  registerPushTokenForCurrentUser,
  pushPlatform,
  resolvePushProjectId,
} from '@/lib/pushNotifications';

// expo-notifications is a native module — mock it entirely; the real device
// registration path is E2E-manual (5.10 checklist), unit tests cover the
// orchestration contract.
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: 'test-project' } } },
    easConfig: undefined,
  },
}));

jest.mock('@/api/clientNotifications', () => ({
  registerDeviceToken: jest.fn(),
}));

// Native storage modules pulled in via authStorage.
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

// Force the iOS platform for the orchestration tests (pushPlatform() decides
// android|ios|null; the web case is covered by the pure-function test).
jest.replaceProperty(Platform, 'OS', 'ios');

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetToken = Notifications.getExpoPushTokenAsync as jest.Mock;
const mockRegisterDeviceToken = registerDeviceToken as jest.Mock;
const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

const TOKEN = 'ExponentPushToken[test-device-token]';

describe('pushPlatform', () => {
  it('maps android/ios and rejects everything else', () => {
    expect(pushPlatform('android')).toBe('android');
    expect(pushPlatform('ios')).toBe('ios');
    expect(pushPlatform('web')).toBeNull();
    expect(pushPlatform('windows')).toBeNull();
  });
});

describe('resolvePushProjectId', () => {
  const base: Parameters<typeof resolvePushProjectId>[0] = { env: {} };

  it('prefers EXPO_PUBLIC_EAS_PROJECT_ID over app config', () => {
    expect(
      resolvePushProjectId({
        env: { EXPO_PUBLIC_EAS_PROJECT_ID: 'env-project' },
        extra: { eas: { projectId: 'extra-project' } },
      }),
    ).toBe('env-project');
  });

  it('falls back to app.json extra.eas.projectId then eas.json', () => {
    expect(resolvePushProjectId({ ...base, extra: { eas: { projectId: 'extra-project' } } })).toBe('extra-project');
    expect(resolvePushProjectId({ ...base, easConfig: { projectId: 'easjson-project' } })).toBe('easjson-project');
  });

  it('returns undefined when no project source exists (dev)', () => {
    expect(resolvePushProjectId(base)).toBeUndefined();
  });
});

describe('registerPushTokenForCurrentUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetToken.mockResolvedValue({ data: TOKEN });
    mockRegisterDeviceToken.mockResolvedValue({ registered: true, devices: 1 });
    mockGetItem.mockResolvedValue(null); // no stored token by default
    (Constants as any).expoConfig.extra.eas.projectId = 'test-project';
  });

  it('registers the token and persists it when permission is granted', async () => {
    const result = await registerPushTokenForCurrentUser();

    expect(mockGetPermissions).toHaveBeenCalled();
    expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'test-project' });
    expect(mockRegisterDeviceToken).toHaveBeenCalledWith(TOKEN, 'ios');
    expect(mockSetItem).toHaveBeenCalledWith('@courier/push-token', TOKEN);
    expect(result).toEqual({ registered: true, token: TOKEN });
  });

  it('skips registration entirely when permission is denied (no user error)', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied' });
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });

    const result = await registerPushTokenForCurrentUser();

    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(result).toEqual({ registered: false, skippedReason: 'permission-denied' });
  });

  it('skips when no EAS projectId is configured (dev)', async () => {
    (Constants as any).expoConfig.extra.eas.projectId = undefined;

    const result = await registerPushTokenForCurrentUser();

    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
    expect(result).toEqual({ registered: false, skippedReason: 'no-project-id' });
  });

  it('does not call the API again when the token is unchanged (once per token)', async () => {
    mockGetItem.mockResolvedValue(TOKEN);

    const result = await registerPushTokenForCurrentUser();

    expect(mockRegisterDeviceToken).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
    expect(result).toEqual({ registered: true, token: TOKEN });
  });

  it('swallows registration failures (best-effort, no throw)', async () => {
    mockRegisterDeviceToken.mockRejectedValue(new Error('network down'));

    await expect(registerPushTokenForCurrentUser()).resolves.toEqual({ registered: false });
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('single-flights concurrent calls into one registration', async () => {
    let resolveTokenPromise!: (v: { data: string }) => void;
    const pending = new Promise<{ data: string }>((resolve) => {
      resolveTokenPromise = resolve;
    });
    mockGetToken.mockReturnValue(pending);

    const first = registerPushTokenForCurrentUser();
    const second = registerPushTokenForCurrentUser();
    expect(second).toBe(first); // same in-flight promise, not a second registration

    resolveTokenPromise({ data: TOKEN });
    await Promise.all([first, second]);

    expect(mockRegisterDeviceToken).toHaveBeenCalledTimes(1);
  });
});
