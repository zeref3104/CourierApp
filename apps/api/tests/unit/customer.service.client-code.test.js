/**
 * Unit tests for CustomerService global client code generation (client-code-identity spec):
 * - With master context ({ companyId, clientCodePrefix, masterConnection }): new
 *   customers get a global {PREFIX}-{SEQ} code via masterCounter.nextSequence.
 * - Without master context (legacy/rollback): falls back to the tenant counter
 *   and the CUS- format.
 * - PATCH can never mutate the code (immutable).
 */
jest.mock('../../src/repositories/base/base.repository', () =>
  jest.fn().mockImplementation(() => ({
    create: jest.fn((data) => Promise.resolve({ ...data, _id: 'customer-1' })),
    findById: jest.fn().mockResolvedValue({ _id: 'customer-1', email: 'juan@x.co' }),
    findAll: jest.fn(),
    updateById: jest.fn((id, data) => Promise.resolve({ _id: id, ...data })),
    softDelete: jest.fn(),
  }))
);

const CustomerService = require('../../src/modules/customers/customer.service');

const PAYLOAD = {
  name: 'Juan',
  lastName: 'Perez',
  phone: '8095551234',
  branchId: 'branch-1',
};

function makeModels() {
  return {
    Customer: {
      findOne: jest.fn((query) => {
        // Email conflict checks await the query result; the seedFrom query
        // (findOne({}).sort().select()) needs a chainable cursor.
        if (query && query.email !== undefined) return Promise.resolve(null);
        return {
          sort: jest.fn(() => ({
            select: jest.fn().mockResolvedValue(null),
          })),
        };
      }),
    },
    Branch: {
      findOne: jest.fn().mockResolvedValue(null),
    },
    Counter: {
      findOne: jest.fn().mockResolvedValue(null),
      findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 3 }),
    },
  };
}

describe('CustomerService code generation', () => {
  test('uses the master counter and prefix when master context is provided', async () => {
    const findOneAndUpdate = jest.fn().mockResolvedValue({ seq: 7 });
    const masterConnection = { model: jest.fn(() => ({ findOneAndUpdate })) };
    const models = makeModels();

    const service = new CustomerService(models, {
      masterConnection,
      companyId: 'company-1',
      clientCodePrefix: 'RB',
    });
    await service.create(PAYLOAD, 'branch-1');

    const created = service.repository.create.mock.calls[0][0];
    expect(created.code).toBe('RB-000007');
    expect(masterConnection.model).toHaveBeenCalledWith('CompanyCounter');
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { companyId: 'company-1' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
  });

  test('falls back to the tenant counter and CUS- format without master context', async () => {
    const models = makeModels();
    const service = new CustomerService(models);

    await service.create(PAYLOAD, 'branch-1');

    const created = service.repository.create.mock.calls[0][0];
    expect(created.code).toBe('CUS-0003');
    expect(models.Counter.findOneAndUpdate).toHaveBeenCalled();
  });

  test('PATCH can never change the customer code', async () => {
    const models = makeModels();
    const service = new CustomerService(models);

    const updated = await service.update('customer-1', { name: 'Juana', code: 'ZZ-999999' });

    expect(updated.name).toBe('Juana');
    expect(updated.code).toBeUndefined();
  });
});
