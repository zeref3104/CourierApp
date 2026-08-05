/**
 * Integration tests for notificationHandler.onPackageStatusChanged push dispatch
 * (client-mobile-app task 4.7, push-notifications spec + design D12/D13) using
 * mocked mongoose models (direct-handler test; no MongoDB needed):
 * - status change writes the customer `in_app` Notification AND pushes to every
 *   registered device token (payload carries package metadata, sound default)
 * - a customer with NO device tokens gets the in_app write but NO push call
 * - an Expo send failure is tolerated (best-effort): flow completes, error logged
 * - title/body are localized via the tenant language (es default)
 */
jest.mock('../../src/services/notifications/push.service', () => ({
  sendPush: jest.fn(async () => ({ sent: 0, failed: 0, chunks: 0 })),
}));
jest.mock('../../src/events/handlers/socketHandler', () => ({
  onNotificationCreated: jest.fn(),
}));
jest.mock('../../src/services/notifications/email.service', () => ({
  sendPackageStatusNotification: jest.fn(async () => ({})),
  sendDeliveryNotification: jest.fn(async () => ({})),
  sendOtpCode: jest.fn(async () => ({})),
}));

const { sendPush } = require('../../src/services/notifications/push.service');
const notificationHandler = require('../../src/events/handlers/notificationHandler');

const TOKEN_A = 'ExponentPushToken[dev_A]';
const TOKEN_B = 'ExponentPushToken[dev_B]';

let capturedNotifications = [];

function makeUser(tokenRefs = []) {
  return { deviceTokens: tokenRefs.map((t) => ({ token: t.token, platform: t.platform || 'android' })) };
}

function makePkg({ toStatus = 'disponible', customerId = 'cust-1', tracking = 'RB-000001', user } = {}) {
  const models = {
    Setting: {
      db: { name: 'tenant_db' },
      findOne: async (query) => (query.key === 'language' ? { value: 'es' } : null),
    },
    Customer: {
      findById: async () => ({ email: 'client@example.com', name: 'Cliente', lastName: 'Uno' }),
    },
    Notification: {
      create: async (data) => {
        capturedNotifications.push(data);
        return data;
      },
    },
    User: {
      findOne: async () => user || makeUser(),
    },
  };
  return {
    customerId,
    tracking: 'RB-000001',
    status: 'recibido_miami',
    toStatus,
    _id: 'pkg-1',
    model: (name) => models[name],
  };
}

describe('notificationHandler.onPackageStatusChanged (push dispatch, D12/D13)', () => {
  beforeEach(() => {
    capturedNotifications = [];
    sendPush.mockClear();
    sendPush.mockResolvedValue({ sent: 0, failed: 0, chunks: 0 });
  });

  test('writes in_app AND pushes to every registered token with the package payload', async () => {
    const user = makeUser([{ token: TOKEN_A }, { token: TOKEN_B }]);
    const pkg = makePkg({ toStatus: 'disponible', user });

    await notificationHandler.onPackageStatusChanged({ package: pkg, toStatus: 'disponible', tenantSlug: 'rapid-box' });

    // Customer in_app notification was written
    expect(capturedNotifications.some((n) => n.channel === 'in_app' && n.customerId === 'cust-1')).toBe(true);

    // Push called ONCE with both tokens
    expect(sendPush).toHaveBeenCalledTimes(1);
    const [tokens, payload] = sendPush.mock.calls[0];
    expect(tokens).toEqual([TOKEN_A, TOKEN_B]);
    expect(payload.title).toContain('listo para recoger');
    expect(payload.data).toEqual({
      type: 'package_status',
      packageId: 'pkg-1',
      trackingNumber: 'RB-000001',
      status: 'disponible',
      companySlug: 'rapid-box',
    });
  });

  test('no device tokens => in_app written, NO push call', async () => {
    const pkg = makePkg({ user: makeUser([]) });
    await notificationHandler.onPackageStatusChanged({ package: pkg, toStatus: 'disponible', tenantSlug: 'rapid-box' });

    expect(capturedNotifications.some((n) => n.channel === 'in_app' && n.customerId)).toBe(true);
    expect(sendPush).not.toHaveBeenCalled();
  });

  test('customer has no linked user => in_app written, NO push call', async () => {
    const pkg = makePkg({ user: null });
    await notificationHandler.onPackageStatusChanged({ package: pkg, toStatus: 'disponible', tenantSlug: 'rapid-box' });

    expect(capturedNotifications.some((n) => n.channel === 'in_app' && n.customerId)).toBe(true);
    expect(sendPush).not.toHaveBeenCalled();
  });

  test('Expo send error is tolerated: flow completes and error logged (never throws)', async () => {
    const user = makeUser([{ token: TOKEN_A }]);
    const pkg = makePkg({ user });
    sendPush.mockRejectedValue(new Error('Expo API unavailable'));

    await expect(
      notificationHandler.onPackageStatusChanged({ package: pkg, toStatus: 'en_reparto', tenantSlug: 'rapid-box' })
    ).resolves.toBeUndefined();
    expect(capturedNotifications.some((n) => n.channel === 'in_app' && n.customerId === 'cust-1')).toBe(true);
  });
});