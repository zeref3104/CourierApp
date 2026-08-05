/**
 * Unit tests for ClientService.registerDeviceToken (client-mobile-app task 4.1,
 * push-notifications spec + design D11):
 * - stores a new {token, platform} on the client's User (201 {registered, devices})
 * - duplicate token is idempotent (no duplicate record, platform refreshed)
 * - 6th distinct token is rejected with 400 (cap of 5 devices)
 * - unknown user -> NotFoundException
 */
const ClientService = require('../../src/modules/client/client.service');

function makeUser(deviceTokens = []) {
  return {
    deviceTokens: deviceTokens.map((dt) => ({ token: dt.token, platform: dt.platform, createdAt: dt.createdAt || new Date(), updatedAt: dt.updatedAt || new Date() })),
    save: jest.fn(async function save() {
      return this;
    }),
  };
}

function makeModels(user) {
  return {
    Package: {},
    User: { findById: jest.fn(async () => user) },
  };
}

const TOKEN_A = 'ExponentPushToken[tokA_123]';
const TOKEN_B = 'ExponentPushToken[tokB_456]';

describe('ClientService.registerDeviceToken', () => {
  test('registers a new token: appends {token, platform} and returns {registered, devices}', async () => {
    const user = makeUser();
    const service = new ClientService(makeModels(user));

    const result = await service.registerDeviceToken('user-1', { token: TOKEN_A, platform: 'android' });

    expect(result).toEqual({ registered: true, devices: 1 });
    expect(user.deviceTokens).toHaveLength(1);
    expect(user.deviceTokens[0].token).toBe(TOKEN_A);
    expect(user.deviceTokens[0].platform).toBe('android');
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  test('duplicate token is idempotent and refreshes platform (no second record)', async () => {
    const user = makeUser([{ token: TOKEN_A, platform: 'android', createdAt: new Date() }]);
    const service = new ClientService(makeModels(user));

    const result = await service.registerDeviceToken('user-1', { token: TOKEN_A, platform: 'ios' });

    expect(result).toEqual({ registered: true, devices: 1 });
    expect(user.deviceTokens).toHaveLength(1); // no duplicate pushed
    expect(user.deviceTokens[0].platform).toBe('ios'); // re-registration refreshes the platform
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  test('rejects the 6th distinct token with HTTP 400 (cap of 5 devices)', async () => {
    const tokens = Array.from({ length: 5 }, (_, i) => ({
      token: `ExponentPushToken[tok${i}]`,
      platform: 'android',
    }));
    const user = makeUser(tokens);
    const service = new ClientService(makeModels(user));

    let caught = null;
    try {
      await service.registerDeviceToken('user-1', { token: TOKEN_B, platform: 'ios' });
    } catch (err) {
      caught = err;
    }

    expect(caught).not.toBeNull();
    expect(caught.statusCode).toBe(400);
    expect(user.deviceTokens).toHaveLength(5); // nothing was appended
    expect(user.save).not.toHaveBeenCalled();
  });

  test('throws NotFoundException for an unknown user', async () => {
    const models = makeModels(null);
    models.User.findById = jest.fn(async () => null);
    const service = new ClientService(models);

    let caught = null;
    try {
      await service.registerDeviceToken('unknown', { token: TOKEN_A, platform: 'android' });
    } catch (err) {
      caught = err;
    }

    expect(caught).not.toBeNull();
    expect(caught.statusCode).toBe(404);
  });
});