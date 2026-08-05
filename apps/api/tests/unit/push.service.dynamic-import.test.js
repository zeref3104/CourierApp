/**
 * Unit tests for the CJS-safe dynamic import() seam (design D12): push.service
 * must load the ESM-only expo-server-sdk via dynamic import() when no Expo
 * class is injected, so a `require()` of the CJS API never hits ERR_REQUIRE_ESM.
 *
 * Requires `NODE_OPTIONS=--experimental-vm-modules` (see sdd Apply notes). In
 * Jest CJS, `jest.mock('expo-server-sdk', factory)` does NOT intercept the
 * dynamic `import('expo-server-sdk')` call the service makes (ESM module graph),
 * so the SDK is mocked with the ESM-aware `jest.unstable_mockModule` +
 * `jest.isolateModulesAsync` + dynamic `import()` of the module under test.
 * This keeps the production import() seam intact.
 */
describe('push.service dynamic import (D12)', () => {
  test('loadExpo resolves the packed expo-server-sdk default export (no ERR_REQUIRE_ESM)', async () => {
    await jest.isolateModulesAsync(async () => {
      const { loadExpo } = await import('../../src/services/notifications/push.service');
      const Expo = await loadExpo();
      expect(typeof Expo).toBe('function'); // a constructable class
      const client = new Expo();
      expect(typeof client.sendPushNotificationsAsync).toBe('function');
    });
  });

  test('without an injected Expo, sendPush loads the SDK via import() and sends through it', async () => {
    const mockSendPushNotificationsAsync = jest.fn((messages) =>
      messages.map(() => ({ status: 'ok', id: 'ticket' }))
    );
    jest.unstable_mockModule('expo-server-sdk', () => {
      class MockExpo {
        constructor() {}
        async sendPushNotificationsAsync(messages) {
          return mockSendPushNotificationsAsync(messages);
        }
      }
      MockExpo.pushNotificationChunkSizeLimit = 100;
      return { __esModule: true, default: MockExpo };
    });

    await jest.isolateModulesAsync(async () => {
      const { sendPush } = await import('../../src/services/notifications/push.service');
      const result = await sendPush(['ExponentPushToken[a]', 'ExponentPushToken[b]'], {
        title: 'T',
        body: 'B',
        data: { type: 'package_status' },
      });

      expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(1);
      expect(mockSendPushNotificationsAsync.mock.calls[0][0]).toHaveLength(2);
      expect(result).toEqual({ sent: 2, failed: 0, chunks: 1 });
    });
  });
});