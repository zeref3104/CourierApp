/**
 * Unit tests for CompanyService client code prefix behavior (client-code-identity spec):
 * - create(): suggests a prefix from the company name when absent (design D2)
 * - create(): preserves an admin-provided override (admin-editable)
 * - create(): rejects a prefix already in use with 409 ConflictException (platform-unique)
 * - update(): never mutates clientCodePrefix (set-once, design D1/D7)
 */
jest.mock('../../src/services/tenant/connectionManager', () => ({
  getConnection: jest.fn(),
}));

const companyService = require('../../src/modules/companies/company.service');
const connectionManager = require('../../src/services/tenant/connectionManager');
const ConflictException = require('../../src/exceptions/ConflictException');

const BASE_PAYLOAD = {
  name: 'Rapid Box',
  slug: 'rapid-box',
  email: 'info@rapidbox.co',
  adminEmail: 'admin@rapidbox.co',
};

function makeTenantConnection() {
  const roleModel = {
    findOne: jest.fn((query) =>
      Promise.resolve(query && query.code === 'admin' ? { _id: 'role-admin' } : null)
    ),
    create: jest.fn().mockResolvedValue({}),
  };
  const sharedModel = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    insertMany: jest.fn().mockResolvedValue([]),
  };
  return {
    model: jest.fn((name) => (name === 'Role' ? roleModel : sharedModel)),
  };
}

function makeMasterConnection({ findOne, companyCreate } = {}) {
  const Company = {
    findOne: findOne || jest.fn().mockResolvedValue(null),
    create: companyCreate || jest.fn().mockResolvedValue({
      _id: 'company-1',
      toObject: () => ({ _id: 'company-1', slug: 'rapid-box' }),
    }),
  };
  return {
    model: jest.fn((name) =>
      ({
        Company,
        Plan: {},
        License: { create: jest.fn().mockResolvedValue({}) },
        TenantUserIndex: { create: jest.fn().mockResolvedValue({}) },
      }[name] || {})
    ),
  };
}

describe('CompanyService.create clientCodePrefix', () => {
  beforeEach(() => {
    connectionManager.getConnection.mockResolvedValue(makeTenantConnection());
  });

  test('suggests a prefix from the company name when the payload has none', async () => {
    const masterConnection = makeMasterConnection();
    await companyService.create({ ...BASE_PAYLOAD }, masterConnection);

    const Company = masterConnection.model('Company');
    const createArg = Company.create.mock.calls[0][0];
    expect(createArg.clientCodePrefix).toBe('RB');
  });

  test('preserves the admin-provided prefix override', async () => {
    const masterConnection = makeMasterConnection();
    await companyService.create({ ...BASE_PAYLOAD, clientCodePrefix: 'CS' }, masterConnection);

    const Company = masterConnection.model('Company');
    const createArg = Company.create.mock.calls[0][0];
    expect(createArg.clientCodePrefix).toBe('CS');
  });

  test('rejects with ConflictException when the prefix is already in use', async () => {
    const findOne = jest.fn((query) =>
      Promise.resolve(query.clientCodePrefix ? { slug: 'prefix-owner' } : null)
    );
    const masterConnection = makeMasterConnection({ findOne });

    await expect(
      companyService.create({ ...BASE_PAYLOAD }, masterConnection)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test('upserts the canonical client role at provisioning', async () => {
    const tenantConnection = makeTenantConnection();
    connectionManager.getConnection.mockResolvedValue(tenantConnection);
    const masterConnection = makeMasterConnection();

    await companyService.create({ ...BASE_PAYLOAD }, masterConnection);

    const roleModel = tenantConnection.model('Role');
    const created = roleModel.create.mock.calls.flat();
    expect(
      created.some((role) => role.code === 'client' && role.isSystem === true)
    ).toBe(true);
  });
});

describe('CompanyService.update clientCodePrefix immutability', () => {
  test('ignores clientCodePrefix in update payloads', async () => {
    const companyDoc = {
      _id: 'company-1',
      slug: 'rapid-box',
      save: jest.fn().mockResolvedValue(undefined),
    };
    const masterConnection = {
      model: jest.fn((name) =>
        ({
          Company: {
            findById: jest.fn().mockResolvedValue(companyDoc),
            findOne: jest.fn().mockResolvedValue(null),
          },
          License: { findOne: jest.fn().mockResolvedValue(null) },
          Plan: {},
        }[name] || {})
      ),
    };

    await companyService.update('company-1', { name: 'New Name', clientCodePrefix: 'ZZ' }, masterConnection);

    expect(companyDoc.name).toBe('New Name');
    expect(companyDoc.clientCodePrefix).toBeUndefined();
    expect(companyDoc.save).toHaveBeenCalled();
  });
});
