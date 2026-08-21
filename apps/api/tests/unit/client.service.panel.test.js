/**
 * Unit tests for the client-panel delta (client-mobile-app task 3.5,
 * client-panel-specs delta + design D13):
 * - getPackageByTracking emits amountToPay (pkg.total) + pickupBranch
 *   {id,name,address} ONLY when status === 'disponible'
 * - non-disponible packages expose NO amount-to-pay
 * - getNotifications returns only in_app + push channel records
 */
const ClientService = require('../../src/modules/client/client.service');

/** Build a Mongo-like find().populate() chain for getPackageByTracking. */
function packageQuery(pkgDoc) {
  return { populate: jest.fn().mockResolvedValue(pkgDoc) };
}

/** Build find().sort().populate().lean() chain for the history query. */
function historyQuery(history) {
  return {
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(history),
  };
}

function makeModels({ pkgDoc, history = [{ status: 'disponible', createdAt: new Date() }], currency = 'USD' } = {}) {
  const models = {
    Package: { findOne: jest.fn().mockReturnValue(packageQuery(pkgDoc)) },
    PackageHistory: { find: jest.fn().mockReturnValue(historyQuery(history)) },
    Notification: {},
    // getPackageByTracking reads the tenant `currency` setting for disponible packages
    Setting: {
      findOne: jest.fn().mockResolvedValue(currency ? { key: 'currency', value: currency } : null),
    },
  };

  // getNotifications runs through BaseRepository.findAll -> find().countDocuments()
  const notificationQuery = {};
  notificationQuery.sort = jest.fn().mockReturnThis();
  notificationQuery.skip = jest.fn().mockReturnThis();
  notificationQuery.limit = jest.fn().mockReturnThis();
  notificationQuery.select = jest.fn().mockReturnThis();
  notificationQuery.populate = jest.fn().mockReturnThis();
  models.Notification.find = jest.fn().mockReturnValue(notificationQuery);
  models.Notification.countDocuments = jest.fn().mockResolvedValue(0);

  return models;
}

function disponiblePackage() {
  return {
    status: 'disponible',
    total: 123.45,
    branchId: { _id: 'branch-1', name: 'Main Branch', address: 'Av. Principal 123', phone: '809' },
    toObject: () => ({ tracking: 'CPR-20260101-0001', status: 'disponible', total: 123.45 }),
  };
}

function nonDisponiblePackage() {
  return {
    status: 'en_reparto',
    total: 999.99,
    branchId: null,
    toObject: () => ({ tracking: 'CPR-20260101-0002', status: 'en_reparto', total: 999.99 }),
  };
}

describe('ClientService.getPackageByTracking (amountToPay gating)', () => {
  test('disponible: exposes amountToPay + pickupBranch {id,name,address}', async () => {
    const pkg = disponiblePackage();
    const service = new ClientService(makeModels({ pkgDoc: pkg }));

    const result = await service.getPackageByTracking('CPR-20260101-0001', 'customer-1');

    expect(result.amountToPay).toBe(123.45);
    expect(result.pickupBranch).toEqual({
      id: 'branch-1',
      name: 'Main Branch',
      address: 'Av. Principal 123',
    });
    // tenant currency is disclosed alongside the amount
    expect(result.currency).toBe('USD');
    // history timeline still attached
    expect(result.history).toHaveLength(1);
  });

  test('disponible: currency falls back to DOP when the setting is missing', async () => {
    const pkg = disponiblePackage();
    const service = new ClientService(makeModels({ pkgDoc: pkg, currency: null }));

    const result = await service.getPackageByTracking('CPR-20260101-0001', 'customer-1');

    expect(result.currency).toBe('DOP');
  });

  test('en_reparto: exposes NO amount-to-pay and no pickup branch', async () => {
    const pkg = nonDisponiblePackage();
    const service = new ClientService(makeModels({ pkgDoc: pkg }));

    const result = await service.getPackageByTracking('CPR-20260101-0002', 'customer-1');

    expect('amountToPay' in result).toBe(false);
    expect('pickupBranch' in result).toBe(false);
    // the raw amount fields must not leak for non-disponible packages
    expect('total' in result).toBe(false);
    expect('cost' in result).toBe(false);
    // currency travels with the amount disclosure — absent when no amount is
    expect('currency' in result).toBe(false);
  });

  test('disponible package is found by tracking scoped to the customer', async () => {
    const pkg = disponiblePackage();
    const models = makeModels({ pkgDoc: pkg });
    const service = new ClientService(models);

    await service.getPackageByTracking('CPR-20260101-0001', 'customer-1');

    expect(models.Package.findOne).toHaveBeenCalledWith({ tracking: 'CPR-20260101-0001', customerId: 'customer-1' });
  });
});

describe('ClientService.getNotifications (channel filter)', () => {
  test('filters to in_app + push channels only', async () => {
    const models = makeModels({});
    const service = new ClientService(models);

    await service.getNotifications('customer-1', { page: 1, limit: 20 });

    expect(models.Notification.find).toHaveBeenCalledWith({
      customerId: 'customer-1',
      channel: { $in: ['in_app', 'push'] },
    });
    expect(models.Notification.countDocuments).toHaveBeenCalledWith({
      customerId: 'customer-1',
      channel: { $in: ['in_app', 'push'] },
    });
  });
});