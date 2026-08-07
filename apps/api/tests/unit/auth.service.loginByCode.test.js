/**
 * Unit tests for authService.loginByCode + authService.resolveTenantByCode
 * (client-mobile-app tasks 3.2/3.3, client-code-login spec, design D9):
 * - tenant resolution: parse prefix from code -> Company.findOne({clientCodePrefix})
 *   -> active/license check -> connectionManager.getConnection
 * - customer lookup by full code, linked isClient User, bcrypt compare
 * - 404 unknown prefix / unknown customer code; 401 wrong password / locked /
 *   inactive user / inactive company / missing license
 * - token issuance: client JWT claims + refresh token (hash stored)
 * - lockout reuse: same 5-attempt / 30-min pattern as staff auth.service.login
 */
const authService = require('../../src/modules/auth/auth.service');
const connectionManager = require('../../src/services/tenant/connectionManager');
const jwtService = require('../../src/services/auth/jwt.service');
const tokenService = require('../../src/modules/auth/token.service');
const NotFoundException = require('../../src/exceptions/NotFoundException');
const UnauthorizedException = require('../../src/exceptions/UnauthorizedException');

jest.mock('../../src/services/tenant/connectionManager', () => ({ getConnection: jest.fn() }));
jest.mock('../../src/services/auth/jwt.service', () => ({ generateAccessToken: jest.fn() }));
jest.mock('../../src/modules/auth/token.service', () => ({
  generateRefreshToken: jest.fn(),
  hashToken: jest.fn(),
}));

/** A Mongo-like doc: plain data + save() spy (matches how the service uses docs). */
function makeDoc(overrides = {}) {
  return {
    _id: 'model-1',
    save: jest.fn().mockResolvedValue(undefined),
    comparePassword: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

/** A model-like constructor with the statics loginByCode uses (findOne/findById). */
function makeModel({ findOne, findById } = {}) {
  const Model = jest.fn();
  Model.findOne = findOne || jest.fn();
  Model.findById = findById || jest.fn();
  return Model;
}

const BASE_COMPANY = {
  _id: 'company-1',
  slug: 'rapid-box',
  name: 'Rapid Box',
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
  const customer =
    overrides.customer !== undefined
      ? overrides.customer
      : { _id: 'customer-1', code: 'RB-000001', name: 'Cliente Uno' };
  const role = overrides.role !== undefined ? overrides.role : { _id: 'role-client', code: 'client', permissions: [] };
  const user =
    overrides.user !== undefined
      ? overrides.user
      : makeDoc({
          _id: 'user-1',
          email: 'cliente@example.com',
          name: 'Cliente Uno',
          roleId: 'role-client',
          branchId: 'branch-1',
          clientId: 'customer-1',
          isClient: true,
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLogin: null,
          refreshToken: null,
          previousRefreshTokenHash: null,
        });

  const models = {
    Company: makeModel({ findOne: jest.fn().mockResolvedValue(company) }),
    License: makeModel({ findOne: jest.fn().mockResolvedValue(license) }),
    Customer: makeModel({ findOne: jest.fn().mockResolvedValue(customer) }),
    User: makeModel({
      // findOne returns a query chain: .select('+password') resolves the doc
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) }),
    }),
    Role: makeModel({ findById: jest.fn().mockResolvedValue(role) }),
  };

  const masterConnection = { model: jest.fn((name) => models[name]) };
  const tenantConnection = { model: jest.fn((name) => models[name]) };
  connectionManager.getConnection.mockResolvedValue(tenantConnection);

  return { company, license, customer, user, role, models, masterConnection, tenantConnection };
}

beforeEach(() => {
  jest.clearAllMocks();
  jwtService.generateAccessToken.mockReturnValue('access-token-1');
  tokenService.generateRefreshToken.mockReturnValue('refresh-token-1');
  tokenService.hashToken.mockReturnValue('hashed-refresh-1');
});

describe('authService.resolveTenantByCode', () => {
  test('parses the prefix and resolves the company + tenant connection', async () => {
    const ctx = setup();
    const result = await authService.resolveTenantByCode('RB-000001', ctx.masterConnection);

    expect(ctx.models.Company.findOne).toHaveBeenCalledWith({ clientCodePrefix: 'RB' });
    expect(result.company.slug).toBe('rapid-box');
    expect(result.tenantConnection).toBe(ctx.tenantConnection);
    expect(connectionManager.getConnection).toHaveBeenCalledWith({
      id: 'company-1',
      slug: 'rapid-box',
      dbName: 'courier_test_tenant',
      plan: 'plan-1',
    });
  });

  test('throws 404 when the prefix matches no company', async () => {
    const ctx = setup({ company: null });
    await expect(authService.resolveTenantByCode('XX-000001', ctx.masterConnection)).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(connectionManager.getConnection).not.toHaveBeenCalled();
  });

  test('throws 401 when the company is inactive or suspended', async () => {
    const ctx = setup({ company: { ...BASE_COMPANY, isActive: false } });
    await expect(authService.resolveTenantByCode('RB-000001', ctx.masterConnection)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(connectionManager.getConnection).not.toHaveBeenCalled();
  });

  test('throws 401 when the company license is missing or expired', async () => {
    const ctx = setup({ license: null });
    await expect(authService.resolveTenantByCode('RB-000001', ctx.masterConnection)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(connectionManager.getConnection).not.toHaveBeenCalled();
  });
});

describe('authService.loginByCode', () => {
  test('200: issues client tokens and the limited profile with company info', async () => {
    const ctx = setup();
    const result = await authService.loginByCode({ code: 'RB-000001', password: 'Passw0rd!', masterConnection: ctx.masterConnection });

    expect(result.accessToken).toBe('access-token-1');
    expect(result.refreshToken).toBe('refresh-token-1');
    expect(result.client).toEqual({
      id: 'customer-1',
      code: 'RB-000001',
      name: 'Cliente Uno',
      company: { slug: 'rapid-box', name: 'Rapid Box', prefix: 'RB' },
    });

    // Customer found by FULL code in the resolved tenant
    expect(ctx.models.Customer.findOne).toHaveBeenCalledWith({ code: 'RB-000001' });
    // Linked isClient User resolved by clientId (password field selected for bcrypt)
    expect(ctx.models.User.findOne).toHaveBeenCalledWith({ clientId: 'customer-1', isClient: true });

    // bcrypt compare executed
    expect(ctx.user.comparePassword).toHaveBeenCalledWith('Passw0rd!');

    // refresh token hashed + stored, replay chain reset, lastLogin set
    expect(ctx.user.refreshToken).toBe('hashed-refresh-1');
    expect(ctx.user.previousRefreshTokenHash).toBeNull();
    expect(ctx.user.lastLogin).toBeInstanceOf(Date);
    expect(ctx.user.save).toHaveBeenCalled();

    // client JWT claims
    expect(jwtService.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'client',
        isClient: true,
        clientId: 'customer-1',
        tenant: 'rapid-box',
        _id: 'user-1',
      })
    );
  });

  test('404: unknown customer code for a valid prefix', async () => {
    const ctx = setup({ customer: null });
    await expect(
      authService.loginByCode({ code: 'RB-999999', password: 'Passw0rd!', masterConnection: ctx.masterConnection })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ctx.user.comparePassword).not.toHaveBeenCalled();
    expect(jwtService.generateAccessToken).not.toHaveBeenCalled();
  });

  test('401: wrong password increments the attempt counter and issues no tokens', async () => {
    const ctx = setup({ user: makeDoc({ _id: 'user-1', clientId: 'customer-1', isClient: true, isActive: true, failedLoginAttempts: 0, comparePassword: jest.fn().mockResolvedValue(false) }) });
    await expect(
      authService.loginByCode({ code: 'RB-000001', password: 'wrong', masterConnection: ctx.masterConnection })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ctx.user.failedLoginAttempts).toBe(1);
    expect(ctx.user.save).toHaveBeenCalled();
    expect(jwtService.generateAccessToken).not.toHaveBeenCalled();
  });

  test('401: locks the account after 5 failed attempts (staff lockout pattern)', async () => {
    const ctx = setup({ user: makeDoc({ _id: 'user-1', clientId: 'customer-1', isClient: true, isActive: true, failedLoginAttempts: 4, comparePassword: jest.fn().mockResolvedValue(false) }) });
    await expect(
      authService.loginByCode({ code: 'RB-000001', password: 'wrong', masterConnection: ctx.masterConnection })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ctx.user.failedLoginAttempts).toBe(0);
    expect(ctx.user.lockedUntil).toBeInstanceOf(Date);
    expect(ctx.user.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  test('401: a locked account is rejected before the password check', async () => {
    const ctx = setup({ user: makeDoc({ _id: 'user-1', clientId: 'customer-1', isClient: true, isActive: true, lockedUntil: new Date(Date.now() + 60 * 60 * 1000) }) });
    await expect(
      authService.loginByCode({ code: 'RB-000001', password: 'Passw0rd!', masterConnection: ctx.masterConnection })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ctx.user.comparePassword).not.toHaveBeenCalled();
  });

  test('401: an inactive isClient user cannot log in', async () => {
    const ctx = setup({ user: makeDoc({ _id: 'user-1', clientId: 'customer-1', isClient: true, isActive: false }) });
    await expect(
      authService.loginByCode({ code: 'RB-000001', password: 'Passw0rd!', masterConnection: ctx.masterConnection })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.generateAccessToken).not.toHaveBeenCalled();
  });

  test('401: a customer without a linked isClient User is rejected as invalid credentials', async () => {
    const ctx = setup({ user: null });
    await expect(
      authService.loginByCode({ code: 'RB-000001', password: 'Passw0rd!', masterConnection: ctx.masterConnection })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.generateAccessToken).not.toHaveBeenCalled();
  });

  test('success resets the failed-attempt counter and clears the lock', async () => {
    const ctx = setup({
      user: makeDoc({ _id: 'user-1', clientId: 'customer-1', isClient: true, isActive: true, failedLoginAttempts: 2, lockedUntil: new Date(), lastLogin: null }),
    });
    await authService.loginByCode({ code: 'RB-000001', password: 'Passw0rd!', masterConnection: ctx.masterConnection });
    expect(ctx.user.failedLoginAttempts).toBe(0);
    expect(ctx.user.lockedUntil).toBeNull();
  });
});
