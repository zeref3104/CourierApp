/**
 * Unit tests for notificationHandler tenant-language resolution and the
 * settings cache invalidation hook (email language follows the tenant
 * `language` Setting; DEFAULT_LANGUAGE env decides the fallback).
 *
 * Mirrors the direct-handler style of notificationHandler.push-dispatch.test.js
 * (mocked mongoose models; no MongoDB needed).
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

// Deployment default for this test file — set BEFORE requiring the handler so
// the module captures DEFAULT_LANGUAGE at load time, then restore the env so
// other test files in the same worker are not affected.
process.env.DEFAULT_LANGUAGE = 'fr';

const { sendPackageStatusNotification } = require('../../src/services/notifications/email.service');
const notificationHandler = require('../../src/events/handlers/notificationHandler');

delete process.env.DEFAULT_LANGUAGE;

let capturedNotifications = [];

function makePkg({ language = 'fr', settingThrows = false } = {}) {
  const models = {
    Setting: {
      db: { name: 'tenant_db' },
      findOne: async (query) => (query.key === 'language' ? { value: language } : null),
    },
    Customer: {
      // getCustomerEmail awaits the chain: model('Customer').findById(...).select(...)
      findById: () => ({
        select: async () => ({ email: 'client@example.com', name: 'Pierre', lastName: 'Martin' }),
      }),
    },
    Notification: {
      create: async (data) => {
        capturedNotifications.push(data);
        return data;
      },
    },
    User: {
      findOne: async () => ({ deviceTokens: [] }),
    },
  };
  return {
    customerId: 'cust-1',
    tracking: 'CPR-000001',
    status: 'recibido_miami',
    _id: 'pkg-1',
    model: (name) => {
      if (name === 'Setting' && settingThrows) {
        throw new Error('Schema has not been registered for model "Setting"');
      }
      return models[name];
    },
  };
}

describe('notificationHandler tenant language (email)', () => {
  beforeEach(() => {
    capturedNotifications = [];
    sendPackageStatusNotification.mockClear();
    // Isolate the module-level settings cache between tests.
    notificationHandler.invalidateSettingsCache('tenant_db', 'language');
  });

  test('sends the email with the tenant language when the Setting is fr', async () => {
    await notificationHandler.onPackageStatusChanged({
      package: makePkg({ language: 'fr' }),
      toStatus: 'almacen_miami',
      tenantSlug: 'probando2',
    });

    expect(sendPackageStatusNotification).toHaveBeenCalledTimes(1);
    const [email, tracking, status, name, lang] = sendPackageStatusNotification.mock.calls[0];
    expect(email).toBe('client@example.com');
    expect(tracking).toBe('CPR-000001');
    expect(status).toBe('almacen_miami');
    expect(name).toBe('Pierre Martin');
    expect(lang).toBe('fr');
  });

  test('falls back to DEFAULT_LANGUAGE when the Setting model lookup throws', async () => {
    await notificationHandler.onPackageStatusChanged({
      package: makePkg({ settingThrows: true }),
      toStatus: 'almacen_miami',
      tenantSlug: 'probando2',
    });

    expect(sendPackageStatusNotification).toHaveBeenCalledTimes(1);
    expect(sendPackageStatusNotification.mock.calls[0][4]).toBe('fr');
  });

  test('falls back to DEFAULT_LANGUAGE for an unsupported stored value', async () => {
    await notificationHandler.onPackageStatusChanged({
      package: makePkg({ language: 'pt' }),
      toStatus: 'almacen_miami',
      tenantSlug: 'probando2',
    });

    expect(sendPackageStatusNotification).toHaveBeenCalledTimes(1);
    expect(sendPackageStatusNotification.mock.calls[0][4]).toBe('fr');
  });

  test('invalidateSettingsCache clears the cached language so the next read refreshes', async () => {
    // First read caches 'fr' from the Setting
    await notificationHandler.onPackageStatusChanged({
      package: makePkg({ language: 'fr' }),
      toStatus: 'almacen_miami',
      tenantSlug: 'probando2',
    });
    expect(sendPackageStatusNotification.mock.calls[0][4]).toBe('fr');

    // The Setting changes on the server to 'en' — without invalidation the
    // cached 'fr' would still be served within the TTL.
    await notificationHandler.onPackageStatusChanged({
      package: makePkg({ language: 'en' }),
      toStatus: 'almacen_miami',
      tenantSlug: 'probando2',
    });
    expect(sendPackageStatusNotification.mock.calls[1][4]).toBe('fr');

    // SettingService.update now calls invalidateSettingsCache — the next read
    // must pick up the new value immediately.
    notificationHandler.invalidateSettingsCache('tenant_db', 'language');
    await notificationHandler.onPackageStatusChanged({
      package: makePkg({ language: 'en' }),
      toStatus: 'almacen_miami',
      tenantSlug: 'probando2',
    });
    expect(sendPackageStatusNotification.mock.calls[2][4]).toBe('en');
  });
});
