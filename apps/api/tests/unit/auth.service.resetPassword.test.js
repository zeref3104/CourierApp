/**
 * Unit tests for the password-recovery auth service (forgot-password spec,
 * tasks 2.2/2.3/3.2, design D1/D2/D3/D4):
 *
 * forgotPassword
 * - 0 index matches -> stage a password_reset code with dispatch:false, NO email,
 *   generic body deep-equal to the known-email path (anti-enumeration R1)
 * - 1 match -> stage + dispatch the reset email
 * - 2+ matches without code -> 409 (exact clientLogin message), nothing staged
 * - 2+ matches with a code that resolves -> stage + dispatch; mismatch -> generic
 * - cooldown inside the purpose window propagates 429 (R4/D2)
 *
 * resetPassword
 * - success: password saved, lockout/flag cleared, refresh chain nulled (R5/R6),
 *   OTP consumed only AFTER user.save() succeeds (D1)
 * - user.save() throws -> OTP NOT consumed (D1: no recovery DoS)
 * - 0 matches / mismatched code -> generic 422 'Invalid or expired code'
 * - ambiguous without code -> 409
 * - bad/expired/exhausted/consumed OTP and missing account -> identical 422
 */
const crypto = require('crypto');
const authService = require('../../src/modules/auth/auth.service');
const connectionManager = require('../../src/services/tenant/connectionManager');
const emailService = require('../../src/services/notifications/email.service');
const ConflictException = require('../../src/exceptions/ConflictException');
const UnprocessableEntityException = require('../../src/exceptions/UnprocessableEntityException');
const TooManyRequestsException = require('../../src/exceptions/TooManyRequestsException');

jest.mock('../../src/services/tenant/connectionManager', () => ({
  getConnection: jest.fn(),
  listConnections: jest.fn(() => []),
}));
jest.mock('../../src/services/auth/jwt.service', () => ({ generateAccessToken: jest.fn() }));
jest.mock('../../src/modules/auth/token.service', () => ({
  generateRefreshToken: jest.fn(),
  hashToken: jest.fn(),
}));
jest.mock('../../src/services/master/counter.service', () => ({ nextSequence: jest.fn() }));
// Real otp.service runs against the mocked master models; only the transport
// is captured (assertions on which template/sender fired).
jest.mock('../../src/services/notifications/email.service', () => ({
  sendOtpCode: jest.fn().mockResolvedValue({ messageId: 'm-register' }),
  sendPasswordResetOtp: jest.fn().mockResolvedValue({ messageId: 'm-reset' }),
}));

const CONFLICT_MESSAGE = 'This email is linked to multiple companies. Sign in with your client code instead.';
const GENERIC_422 = 'Invalid or expired code';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function otpDocWith(overrides = {}) {
  return {
    key: 'cliente@example.com:password_reset',
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

function makeUser(overrides = {}) {
  return {
    _id: 'user-1',
    email: 'cliente@example.com',
    password: 'OldPass1!',
    failedLoginAttempts: 3,
    lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
    mustChangePassword: true,
    refreshToken: 'stolen-refresh-hash',
    previousRefreshTokenHash: 'older-refresh-hash',
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

const VALID_LICENSE = {
  status: 'trial',
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

/**
 * Build a full mock context. `entries` drives ClientEmailIndex (the recovery
 * resolution source); every test overrides only what it exercises.
 */
function setup(overrides = {}) {
  // Default: the email IS indexed for exactly one company (the happy resolution
  // path) so tests that exercise OTP/account behavior reach that code instead
  // of short-circuiting on an unresolvable email. Override with entries: [] for
  // the unknown-email path.
  const entries = overrides.entries || [{ companyId: 'company-1' }];
  const otpDoc = overrides.otpDoc !== undefined ? overrides.otpDoc : otpDocWith();
  const company = overrides.company !== undefined ? overrides.company : BASE_COMPANY;
  const prefixCompany = overrides.prefixCompany !== undefined ? overrides.prefixCompany : null;
  const license = overrides.license !== undefined ? overrides.license : VALID_LICENSE;
  const customer = overrides.customer !== undefined ? overrides.customer : { _id: 'customer-1', email: 'cliente@example.com' };
  const user = overrides.user !== undefined ? overrides.user : makeUser();

  const OtpCode = {
    findOne: jest.fn().mockResolvedValue(otpDoc),
    findOneAndUpdate: jest.fn().mockResolvedValue(otpDoc || {}),
  };
  const ClientEmailIndex = { find: jest.fn().mockResolvedValue(entries) };
  const Company = {
    findById: jest.fn().mockResolvedValue(company),
    findOne: jest.fn().mockResolvedValue(prefixCompany), // clientCodePrefix lookup
  };
  const License = { findOne: jest.fn().mockResolvedValue(license) };

  const masterConnection = {
    model: jest.fn((name) => {
      const models = { OtpCode, ClientEmailIndex, Company, License };
      if (!(name in models)) throw new Error(`unexpected master model: ${name}`);
      return models[name];
    }),
  };

  const Customer = { findOne: jest.fn().mockResolvedValue(customer) };
  const User = { findOne: jest.fn().mockResolvedValue(user) };
  const tenantConnection = {
    model: jest.fn((name) => {
      const models = { Customer, User };
      if (!(name in models)) throw new Error(`unexpected tenant model: ${name}`);
      return models[name];
    }),
  };
  connectionManager.getConnection.mockResolvedValue(tenantConnection);

  return {
    entries,
    otpDoc,
    company,
    prefixCompany,
    license,
    customer,
    user,
    OtpCode,
    ClientEmailIndex,
    Company,
    License,
    Customer,
    User,
    masterConnection,
    tenantConnection,
  };
}

const EMAIL = 'Cliente@Example.com'; // service must normalize case/trim
const NORMALIZED = 'cliente@example.com';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authService.forgotPassword', () => {
  test('known email: stages a password_reset code and dispatches the reset email', async () => {
    const ctx = setup({ entries: [{ companyId: 'company-1' }] });

    const result = await authService.forgotPassword({
      email: EMAIL,
      lang: 'es',
      masterConnection: ctx.masterConnection,
    });

    expect(ctx.ClientEmailIndex.find).toHaveBeenCalledWith({ email: NORMALIZED, isActive: true });
    expect(ctx.OtpCode.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(ctx.OtpCode.findOneAndUpdate.mock.calls[0][0]).toEqual({ key: `${NORMALIZED}:password_reset` });
    expect(emailService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);
    expect(emailService.sendPasswordResetOtp.mock.calls[0][0]).toBe(NORMALIZED);
    expect(emailService.sendPasswordResetOtp.mock.calls[0][1]).toMatch(/^\d{6}$/);
    expect(emailService.sendPasswordResetOtp.mock.calls[0][2]).toBe('es');
    expect(emailService.sendOtpCode).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: true, resendAfter: 60 });
  });

  test('unknown email: stages with dispatch:false, sends NOTHING, generic body deep-equals the known path', async () => {
    const known = setup({ entries: [{ companyId: 'company-1' }] });
    const knownResult = await authService.forgotPassword({
      email: NORMALIZED,
      masterConnection: known.masterConnection,
    });

    jest.clearAllMocks();

    const unknown = setup({ entries: [] });
    const unknownResult = await authService.forgotPassword({
      email: NORMALIZED,
      masterConnection: unknown.masterConnection,
    });

    // identical status-200 body whether or not the email exists (R1)
    expect(unknownResult).toEqual(knownResult);

    // still staged: same upsert, same purpose key, same cooldown semantics (D3)
    expect(unknown.OtpCode.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(unknown.OtpCode.findOneAndUpdate.mock.calls[0][0]).toEqual({ key: `${NORMALIZED}:password_reset` });
    // but no email left the building
    expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();
    expect(emailService.sendOtpCode).not.toHaveBeenCalled();
  });

  test('ambiguous email without code: 409 with the exact clientLogin message, nothing staged', async () => {
    const ctx = setup({ entries: [{ companyId: 'company-1' }, { companyId: 'company-2' }] });

    await expect(
      authService.forgotPassword({ email: EMAIL, masterConnection: ctx.masterConnection })
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      authService.forgotPassword({ email: EMAIL, masterConnection: ctx.masterConnection })
    ).rejects.toThrow(CONFLICT_MESSAGE);

    expect(ctx.OtpCode.findOneAndUpdate).not.toHaveBeenCalled();
    expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  test('ambiguous email with the CORRECT client code: resolves one account, stages + dispatches, generic body', async () => {
    const ctx = setup({
      entries: [{ companyId: 'company-1' }, { companyId: 'company-2' }],
      prefixCompany: BASE_COMPANY, // code prefix RB -> company-1, which IS indexed
    });

    const result = await authService.forgotPassword({
      email: NORMALIZED,
      code: 'RB-000042',
      masterConnection: ctx.masterConnection,
    });

    expect(ctx.Company.findOne).toHaveBeenCalledWith({ clientCodePrefix: 'RB' });
    expect(ctx.OtpCode.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(emailService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: true, resendAfter: 60 });
  });

  test('ambiguous email with a MISMATCHED client code: generic body, staged but no email', async () => {
    const ctx = setup({
      entries: [{ companyId: 'company-1' }, { companyId: 'company-2' }],
      prefixCompany: { ...BASE_COMPANY, _id: 'company-9' }, // valid company, NOT holding this email
    });

    const result = await authService.forgotPassword({
      email: NORMALIZED,
      code: 'RB-000042',
      masterConnection: ctx.masterConnection,
    });

    expect(result).toEqual({ sent: true, resendAfter: 60 });
    expect(ctx.OtpCode.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  test('ambiguous email with an UNKNOWN code prefix: generic body, staged but no email', async () => {
    const ctx = setup({
      entries: [{ companyId: 'company-1' }, { companyId: 'company-2' }],
      prefixCompany: null, // code prefix does not resolve to any company
    });

    const result = await authService.forgotPassword({
      email: NORMALIZED,
      code: 'ZZ-000042',
      masterConnection: ctx.masterConnection,
    });

    expect(result).toEqual({ sent: true, resendAfter: 60 });
    expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  test('a live purpose cooldown propagates 429 (per-purpose key, design D2)', async () => {
    const ctx = setup({
      entries: [],
      otpDoc: otpDocWith({ cooldownUntil: new Date(Date.now() + 30 * 1000) }),
    });

    await expect(
      authService.forgotPassword({ email: NORMALIZED, masterConnection: ctx.masterConnection })
    ).rejects.toBeInstanceOf(TooManyRequestsException);
    expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });
});

describe('authService.resetPassword', () => {
  test('happy path: saves the new password, clears lockout/flag, revokes sessions, consumes the OTP after save (R5/R6/D1)', async () => {
    const ctx = setup();

    const result = await authService.resetPassword({
      email: EMAIL,
      otpCode: '123456',
      newPassword: 'NewPass1!',
      masterConnection: ctx.masterConnection,
    });

    expect(result).toEqual({ reset: true });

    // resolution read the normalized email from the index
    expect(ctx.ClientEmailIndex.find).toHaveBeenCalledWith({ email: NORMALIZED, isActive: true });
    // OTP verified against the password_reset purpose key
    expect(ctx.OtpCode.findOne).toHaveBeenCalledWith({ key: `${NORMALIZED}:password_reset` });

    // R5: password replaced (pre-save hook rehashes), lockout cleared,
    // mustChangePassword cleared; R6: whole refresh-token chain nulled
    expect(ctx.user.password).toBe('NewPass1!');
    expect(ctx.user.failedLoginAttempts).toBe(0);
    expect(ctx.user.lockedUntil).toBeNull();
    expect(ctx.user.mustChangePassword).toBe(false);
    expect(ctx.user.refreshToken).toBeNull();
    expect(ctx.user.previousRefreshTokenHash).toBeNull();
    expect(ctx.user.save).toHaveBeenCalledTimes(1);

    // D1: consumption happens strictly AFTER a successful save
    expect(ctx.otpDoc.consumedAt).toBeInstanceOf(Date);
    expect(ctx.otpDoc.save).toHaveBeenCalledTimes(1);
    const userSaveOrder = ctx.user.save.mock.invocationCallOrder[0];
    const otpSaveOrder = ctx.otpDoc.save.mock.invocationCallOrder[0];
    expect(otpSaveOrder).toBeGreaterThan(userSaveOrder);
  });

  test('D1: when user.save() throws, the OTP stays UNCONSUMED and usable until TTL', async () => {
    const ctx = setup({ user: makeUser({ save: jest.fn().mockRejectedValue(new Error('db down')) }) });

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow('db down');

    expect(ctx.otpDoc.consumedAt).toBeNull();
    expect(ctx.otpDoc.save).not.toHaveBeenCalled();
  });

  test('unknown email: identical generic 422, no OTP lookup, no user mutation', async () => {
    const ctx = setup({ entries: [] });

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow(GENERIC_422);

    expect(ctx.OtpCode.findOne).not.toHaveBeenCalled();
    expect(ctx.user.save).not.toHaveBeenCalled();
  });

  test('ambiguous email without code: 409 with the exact clientLogin message', async () => {
    const ctx = setup({ entries: [{ companyId: 'company-1' }, { companyId: 'company-2' }] });

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow(CONFLICT_MESSAGE);
  });

  test('ambiguous email with a MISMATCHED code: generic 422 (never 404, never reveals existence)', async () => {
    const ctx = setup({
      entries: [{ companyId: 'company-1' }, { companyId: 'company-2' }],
      prefixCompany: { ...BASE_COMPANY, _id: 'company-9' },
    });

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        code: 'RB-000042',
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow(GENERIC_422);
    expect(ctx.user.save).not.toHaveBeenCalled();
  });

  test('wrong OTP: attempts increment but the answer is the IDENTICAL generic 422', async () => {
    const ctx = setup();

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '000000',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '000000',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow(GENERIC_422);

    expect(ctx.otpDoc.attempts).toBe(2);
    expect(ctx.user.save).not.toHaveBeenCalled();
    expect(ctx.otpDoc.consumedAt).toBeNull();
  });

  test('expired OTP: generic 422, no user mutation', async () => {
    const ctx = setup({ otpDoc: otpDocWith({ expiresAt: new Date(Date.now() - 1000) }) });

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow(GENERIC_422);
    expect(ctx.user.save).not.toHaveBeenCalled();
  });

  test('OTP exhausted after 5 failed attempts: generic 422, correct code still rejected (R4)', async () => {
    const ctx = setup({ otpDoc: otpDocWith({ attempts: 5 }) });

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow(GENERIC_422);
    expect(ctx.user.save).not.toHaveBeenCalled();
  });

  test('already-consumed OTP: single-use, generic 422 (R4)', async () => {
    const ctx = setup({ otpDoc: otpDocWith({ consumedAt: new Date() }) });

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow(GENERIC_422);
    expect(ctx.user.save).not.toHaveBeenCalled();
  });

  test('no linked client account in the tenant: generic 422, no mutation (R5)', async () => {
    const ctx = setup({ customer: null });

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow(GENERIC_422);
    expect(ctx.User.findOne).not.toHaveBeenCalled();
    expect(ctx.otpDoc.consumedAt).toBeNull();
  });

  test('index entry exists but no linked isClient User: generic 422, OTP stays unconsumed (R5)', async () => {
    const ctx = setup({ user: null });

    await expect(
      authService.resetPassword({
        email: NORMALIZED,
        otpCode: '123456',
        newPassword: 'NewPass1!',
        masterConnection: ctx.masterConnection,
      })
    ).rejects.toThrow(GENERIC_422);
    expect(ctx.Customer.findOne).toHaveBeenCalledWith({ email: NORMALIZED });
    expect(ctx.User.findOne).toHaveBeenCalledWith({ clientId: 'customer-1', isClient: true });
    expect(ctx.otpDoc.consumedAt).toBeNull();
    expect(ctx.otpDoc.save).not.toHaveBeenCalled();
  });
});
