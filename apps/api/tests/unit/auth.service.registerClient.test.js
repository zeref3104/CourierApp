/**
 * Unit tests for authService.registerClient (client-mobile-app task 2.6):
 * - company resolution: must be active, non-suspended, with a valid license (404 otherwise)
 * - branch resolution: must be active and belong to the company (404 otherwise)
 * - OTP verification: hash compare, expiry, lockout, single-use consumption
 * - email uniqueness within the tenant (409 before any creation)
 * - atomic Customer + isClient User creation: transaction path, and the
 *   compensating-delete fallback when the deployment is standalone (design D8)
 * - auto-login tokens in the register response shape (design contract)
 */
const crypto = require('crypto');
const authService = require('../../src/modules/auth/auth.service');
const connectionManager = require('../../src/services/tenant/connectionManager');
const masterCounter = require('../../src/services/master/counter.service');
const jwtService = require('../../src/services/auth/jwt.service');
const tokenService = require('../../src/modules/auth/token.service');
const NotFoundException = require('../../src/exceptions/NotFoundException');
const ConflictException = require('../../src/exceptions/ConflictException');
const UnprocessableEntityException = require('../../src/exceptions/UnprocessableEntityException');

jest.mock('../../src/services/tenant/connectionManager', () => ({ getConnection: jest.fn() }));
jest.mock('../../src/services/master/counter.service', () => ({ nextSequence: jest.fn() }));
jest.mock('../../src/services/auth/jwt.service', () => ({ generateAccessToken: jest.fn() }));
jest.mock('../../src/modules/auth/token.service', () => ({
  generateRefreshToken: jest.fn(),
  hashToken: jest.fn(),
}));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** A Mongo-like doc: plain data + save() spy (matches how the service uses docs). */
function makeDoc(overrides = {}) {
  return {
    _id: 'model-1',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * A model-like constructor: supports both `new Model(data)` (transaction path)
 * and the statics `findOne` / `create` / `deleteOne` (fallback + lookups).
 * Constructor calls are recorded on `Model.mock.calls` for assertions.
 */
function makeModel({ findOne, create, deleteOne, updateOne, countDocuments, startSession, docOverrides = {} } = {}) {
  const Model = jest.fn((data) =>
    makeDoc({ ...docOverrides, ...data, _id: docOverrides._id || (data && data._id) || 'model-1' })
  );
  Model.findOne = findOne || jest.fn();
  Model.create = create || jest.fn();
  Model.deleteOne = deleteOne || jest.fn().mockResolvedValue({ deletedCount: 1 });
  Model.updateOne = updateOne || jest.fn().mockResolvedValue({ upsertedId: { _id: 'index-1' } });
  Model.countDocuments = countDocuments || jest.fn().mockResolvedValue(0);
  Model.db = { startSession: startSession || jest.fn().mockResolvedValue(null) };
  return Model;
}

function otpDocWith(overrides = {}) {
  return {
    codeHash: sha256('123456'),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    cooldownUntil: null,
    verifiedAt: null,
    consumedAt: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const BASE_COMPANY = {
  _id: 'company-1',
  slug: 'rapid-box',
  databaseName: 'courier_test_tenant',
  planId: 'plan-1',
  clientCodePrefix: 'RB',
  isActive: true,
  isSuspended: false,
};

/** Build the full mock context; every test overrides only what it exercises. */
function setup(overrides = {}) {
  const company = overrides.company !== undefined ? overrides.company : BASE_COMPANY;
  const license =
    overrides.license !== undefined
      ? overrides.license
      : { status: 'trial', endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
  const branch =
    overrides.branch !== undefined ? overrides.branch : { _id: 'branch-1', name: 'Main', isActive: true };
  const mainBranch = overrides.mainBranch !== undefined ? overrides.mainBranch : null;
  const otpDoc = overrides.otpDoc !== undefined ? overrides.otpDoc : otpDocWith();
  const clientRole =
    overrides.clientRole !== undefined
      ? overrides.clientRole
      : { _id: 'role-client', code: 'client', name: 'Cliente', permissions: [] };

  const session = overrides.session || {
    withTransaction: jest.fn(async (cb) => cb()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  const customerModel = makeModel({
    findOne: jest.fn().mockResolvedValue(overrides.existingCustomer || null),
    create:
      overrides.customerCreate ||
      jest.fn().mockImplementation((data) => Promise.resolve(makeDoc({ ...data, _id: 'customer-1' }))),
    startSession: jest.fn().mockResolvedValue(session),
    docOverrides: { _id: 'customer-1' },
  });
  const userModel = makeModel({
    findOne: jest.fn().mockResolvedValue(overrides.existingUser || null),
    create:
      overrides.userCreate ||
      jest.fn().mockImplementation((data) => Promise.resolve(makeDoc({ ...data, _id: 'user-1' }))),
    docOverrides: { _id: 'user-1' },
  });

  const models = {
    Company: makeModel({ findOne: jest.fn().mockResolvedValue(company) }),
    License: makeModel({ findOne: jest.fn().mockResolvedValue(license) }),
    OtpCode: makeModel({ findOne: jest.fn().mockResolvedValue(otpDoc) }),
    // Branch resolution: an explicit { _id } lookup resolves the selected
    // branch (null when unknown/inactive); the isMainBranch lookup resolves
    // the main-branch fallback; countDocuments drives the zero-branch
    // self-heal path.
    Branch: makeModel({
      findOne: jest.fn((query) => {
        if (query && query._id) return Promise.resolve(branch);
        return Promise.resolve(mainBranch);
      }),
      countDocuments: jest
        .fn()
        .mockResolvedValue(overrides.branchCount !== undefined ? overrides.branchCount : 0),
      create:
        overrides.branchCreate ||
        jest
          .fn()
          .mockResolvedValue({ _id: 'branch-principal', name: 'Principal', code: 'PRINCIPAL', isActive: true, isMainBranch: true }),
    }),
    // Role.create returns the created doc (real Mongoose behavior) so the
    // self-heal path yields a usable roleId.
    Role: makeModel({
      findOne: jest.fn().mockResolvedValue(clientRole),
      create: jest
        .fn()
        .mockResolvedValue({ _id: 'role-client', code: 'client', name: 'Cliente', permissions: [] }),
    }),
    Customer: customerModel,
    User: userModel,
    // Master email→tenant index created at registration (client-email-login).
    ClientEmailIndex: makeModel({}),
  };

  const masterConnection = { model: jest.fn((name) => models[name]) };
  const tenantConnection = { model: jest.fn((name) => models[name]) };
  connectionManager.getConnection.mockResolvedValue(tenantConnection);

  const payload = {
    companyId: 'company-1',
    branchId: 'branch-1',
    name: 'Cliente',
    lastName: 'Uno',
    phone: '8095551234',
    email: 'Cliente@Example.com',
    password: 'Passw0rd!',
    otpCode: '123456',
    masterConnection,
  };

  return { company, license, branch, otpDoc, clientRole, session, models, masterConnection, tenantConnection, payload };
}

beforeEach(() => {
  jest.clearAllMocks();
  masterCounter.nextSequence.mockResolvedValue(1);
  jwtService.generateAccessToken.mockReturnValue('access-token-1');
  tokenService.generateRefreshToken.mockReturnValue('refresh-token-1');
  tokenService.hashToken.mockReturnValue('hashed-refresh-1');
});

describe('authService.registerClient', () => {
  test('registers a client atomically and returns auto-login tokens', async () => {
    const ctx = setup();
    const result = await authService.registerClient(ctx.payload);

    // Tokens in the register response shape (design contract: accessToken + refreshToken + client)
    expect(result.accessToken).toBe('access-token-1');
    expect(result.refreshToken).toBe('refresh-token-1');
    expect(result.client).toEqual({
      id: 'customer-1',
      code: 'RB-000001',
      name: 'Cliente',
      email: 'cliente@example.com',
    });

    // Customer constructed with the global {PREFIX}-{SEQ} code and normalized email
    const customerData = ctx.models.Customer.mock.calls[0][0];
    expect(customerData.code).toBe('RB-000001');
    expect(customerData.email).toBe('cliente@example.com');
    expect(customerData.branchId).toBe('branch-1');

    // User constructed as an isClient linked to the customer (transaction path uses
    // `new User(...)`, NOT User.create)
    const userData = ctx.models.User.mock.calls[0][0];
    expect(userData.isClient).toBe(true);
    expect(userData.clientId).toBe('customer-1');
    expect(ctx.models.Customer.create).not.toHaveBeenCalled();

    // Sequence came from the master counter
    expect(masterCounter.nextSequence).toHaveBeenCalledWith(ctx.masterConnection, 'company-1');

    // OTP consumed (single-use) after creation
    expect(ctx.otpDoc.consumedAt).toBeInstanceOf(Date);
    expect(ctx.otpDoc.save).toHaveBeenCalledTimes(1);

    // Refresh token persisted on the user
    const userDoc = ctx.models.User.mock.results[0].value;
    expect(userDoc.refreshToken).toBe('hashed-refresh-1');
    expect(userDoc.save).toHaveBeenCalled();

    // Client JWT carries the client claims + tenant slug
    expect(jwtService.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'client', isClient: true, clientId: 'customer-1', tenant: 'rapid-box' })
    );
  });

  test('uses a real tenant session transaction when the deployment supports it', async () => {
    const ctx = setup();
    await authService.registerClient(ctx.payload);
    expect(ctx.session.withTransaction).toHaveBeenCalledTimes(1);
    expect(ctx.session.endSession).toHaveBeenCalledTimes(1);
  });

  test('indexes the client email → tenant on the master DB at registration', async () => {
    const ctx = setup();
    await authService.registerClient(ctx.payload);
    // Idempotent upsert (normalized email, company + per-company uniqueness);
    // must run BEFORE the OTP is consumed so a failed index write can be
    // compensated without leaving a stranded account.
    expect(ctx.models.ClientEmailIndex.updateOne).toHaveBeenCalledWith(
      { email: 'cliente@example.com', companyId: 'company-1' },
      { $setOnInsert: { email: 'cliente@example.com', companyId: 'company-1', isActive: true } },
      { upsert: true }
    );
    const otpSaveCallIndex = ctx.otpDoc.save.mock.invocationCallOrder[0];
    const indexWriteCallIndex = ctx.models.ClientEmailIndex.updateOne.mock.invocationCallOrder[0];
    expect(indexWriteCallIndex).toBeLessThan(otpSaveCallIndex);
  });

  test('rejects with 404 when the company is not found or inactive', async () => {
    const ctx = setup({ company: null });
    await expect(authService.registerClient(ctx.payload)).rejects.toBeInstanceOf(NotFoundException);
    expect(ctx.models.Customer.findOne).not.toHaveBeenCalled();
    expect(ctx.models.Customer.create).not.toHaveBeenCalled();
  });

  test('rejects with 404 when the company has no valid license', async () => {
    const ctx = setup({ license: null });
    await expect(authService.registerClient(ctx.payload)).rejects.toThrow('Company license is not active');
    expect(ctx.models.Customer.create).not.toHaveBeenCalled();
  });

  test('rejects with 404 when the company has no client code prefix', async () => {
    const ctx = setup({
      company: { ...BASE_COMPANY, clientCodePrefix: undefined },
    });
    await expect(authService.registerClient(ctx.payload)).rejects.toThrow(
      'Company is not accepting registrations'
    );
    expect(ctx.models.Customer.create).not.toHaveBeenCalled();
  });

  test('falls back to the main branch when the selected branch is unknown or inactive', async () => {
    const ctx = setup({
      branch: null,
      mainBranch: { _id: 'branch-main', name: 'Principal', isActive: true },
    });
    await authService.registerClient(ctx.payload);
    expect(ctx.models.Customer.mock.calls[0][0].branchId).toBe('branch-main');
    expect(ctx.models.User.mock.calls[0][0].branchId).toBe('branch-main');
  });

  test('registers without a branchId by falling back to the main branch', async () => {
    const ctx = setup({ mainBranch: { _id: 'branch-main', name: 'Principal', isActive: true } });
    await authService.registerClient({ ...ctx.payload, branchId: undefined });
    expect(ctx.models.Customer.mock.calls[0][0].branchId).toBe('branch-main');
  });

  test('self-heals a tenant with zero branches by creating the Principal branch', async () => {
    const ctx = setup({ branch: null, branchCount: 0 });
    await authService.registerClient(ctx.payload);
    expect(ctx.models.Branch.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Principal', code: 'PRINCIPAL', isMainBranch: true, isActive: true })
    );
    expect(ctx.models.Customer.mock.calls[0][0].branchId).toBe('branch-principal');
  });

  test('rejects with 404 when branches exist but none is active or main', async () => {
    const ctx = setup({ branch: null, branchCount: 2 });
    await expect(authService.registerClient(ctx.payload)).rejects.toBeInstanceOf(NotFoundException);
    expect(ctx.models.Customer.create).not.toHaveBeenCalled();
  });

  test('rejects a wrong OTP code with 422 and increments the attempt counter', async () => {
    const ctx = setup();
    await expect(
      authService.registerClient({ ...ctx.payload, otpCode: '000000' })
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(ctx.otpDoc.attempts).toBe(1);
    expect(ctx.otpDoc.save).toHaveBeenCalledTimes(1);
    expect(ctx.models.Customer.mock.calls.length).toBe(0);
  });

  test('rejects an expired OTP with 422', async () => {
    const ctx = setup({ otpDoc: otpDocWith({ expiresAt: new Date(Date.now() - 1000) }) });
    await expect(authService.registerClient(ctx.payload)).rejects.toBeInstanceOf(
      UnprocessableEntityException
    );
    expect(ctx.otpDoc.save).not.toHaveBeenCalled();
    expect(ctx.models.Customer.mock.calls.length).toBe(0);
  });

  test('rejects an OTP invalidated after 5 failed attempts', async () => {
    const ctx = setup({ otpDoc: otpDocWith({ attempts: 5 }) });
    await expect(authService.registerClient(ctx.payload)).rejects.toBeInstanceOf(
      UnprocessableEntityException
    );
    expect(ctx.otpDoc.save).not.toHaveBeenCalled();
  });

  test('rejects with 409 when the email is already registered as a User', async () => {
    const ctx = setup({ existingUser: { _id: 'user-9', email: 'cliente@example.com' } });
    await expect(authService.registerClient(ctx.payload)).rejects.toBeInstanceOf(ConflictException);
    expect(ctx.models.Customer.mock.calls.length).toBe(0);
  });

  test('rejects with 409 when the email is already registered as a Customer', async () => {
    const ctx = setup({ existingCustomer: { _id: 'customer-9', email: 'cliente@example.com' } });
    await expect(authService.registerClient(ctx.payload)).rejects.toBeInstanceOf(ConflictException);
    expect(ctx.models.Customer.mock.calls.length).toBe(0);
  });

  test('self-heals a tenant missing the canonical client role', async () => {
    const ctx = setup({ clientRole: null });
    await authService.registerClient(ctx.payload);
    expect(ctx.models.Role.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'client', isSystem: true, permissions: [] })
    );
  });

  test('falls back to compensating delete when the deployment is standalone and User creation fails', async () => {
    const standaloneError = new Error(
      'Transaction numbers are only allowed on a replica set member or mongos'
    );
    standaloneError.code = 20;
    const ctx = setup({
      session: {
        withTransaction: jest.fn(async () => {
          throw standaloneError;
        }),
        endSession: jest.fn().mockResolvedValue(undefined),
      },
      userCreate: jest.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(authService.registerClient(ctx.payload)).rejects.toThrow('boom');
    // The compensating delete must remove the already-created Customer
    expect(ctx.models.Customer.deleteOne).toHaveBeenCalledWith({ _id: 'customer-1' });
    expect(ctx.otpDoc.consumedAt).toBeNull();
  });
});
