/**
 * Unit tests for the OTP service (client-registration spec + auth-specs delta):
 * - sendOtp: stores a sha256 hash (never the plaintext), 10-min expiry,
 *   60s resend cooldown -> TooManyRequestsException (429), resets attempts,
 *   emails the plaintext code via emailService with the requested lang.
 * - verifyOtp: hash compare, at most 5 failed attempts (invalidate after),
 *   single-use via verifiedAt, expiry enforcement.
 */
const crypto = require('crypto');
const otpService = require('../../src/services/otp.service');
const emailService = require('../../src/services/notifications/email.service');
const TooManyRequestsException = require('../../src/exceptions/TooManyRequestsException');
const UnprocessableEntityException = require('../../src/exceptions/UnprocessableEntityException');

jest.mock('../../src/services/notifications/email.service', () => ({
  sendOtpCode: jest.fn().mockResolvedValue({ messageId: 'logged-1' }),
  sendPasswordResetOtp: jest.fn().mockResolvedValue({ messageId: 'logged-2' }),
}));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function mockOtpDoc(overrides = {}) {
  return {
    codeHash: sha256('123456'),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    cooldownUntil: null,
    verifiedAt: null,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
    ...overrides,
  };
}

function mockMaster(otpDoc) {
  const OtpCode = {
    findOne: jest.fn().mockResolvedValue(otpDoc || null),
    findOneAndUpdate: jest.fn().mockResolvedValue(otpDoc || {}),
  };
  const masterConnection = { model: jest.fn(() => OtpCode) };
  return { masterConnection, OtpCode };
}

describe('otpService.sendOtp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('stores a sha256 hash with 10-min expiry and emails the plaintext code', async () => {
    const { masterConnection, OtpCode } = mockMaster(null);

    const result = await otpService.sendOtp({ email: 'cliente@correo.com', lang: 'es', masterConnection });

    expect(OtpCode.findOne).toHaveBeenCalledWith({ key: 'cliente@correo.com:register' });
    const [, update, options] = OtpCode.findOneAndUpdate.mock.calls[0];
    expect(options).toEqual({ upsert: true, new: true });

    const plainCode = emailService.sendOtpCode.mock.calls[0][1];
    expect(plainCode).toMatch(/^\d{6}$/);
    // The stored hash must match the emailed code, and never store it plaintext
    expect(update.$set.codeHash).toBe(sha256(plainCode));
    expect(update.$set.codeHash).not.toBe(plainCode);
    expect(update.$set.attempts).toBe(0);
    expect(update.$set.verifiedAt).toBeNull();

    const ttlMs = update.$set.expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(9.5 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(10 * 60 * 1000);

    const cooldownMs = update.$set.cooldownUntil.getTime() - Date.now();
    expect(cooldownMs).toBeGreaterThan(55 * 1000);
    expect(cooldownMs).toBeLessThanOrEqual(60 * 1000);

    expect(emailService.sendOtpCode).toHaveBeenCalledWith('cliente@correo.com', plainCode, 'es');
    expect(result).toEqual({ sent: true, resendAfter: 60 });
  });

  test('rejects a resend within the 60s cooldown with 429', async () => {
    const recent = mockOtpDoc({ cooldownUntil: new Date(Date.now() + 30 * 1000) });
    const { masterConnection } = mockMaster(recent);

    await expect(otpService.sendOtp({ email: 'cliente@correo.com', lang: 'es', masterConnection }))
      .rejects.toBeInstanceOf(TooManyRequestsException);

    expect(emailService.sendOtpCode).not.toHaveBeenCalled();
    expect(masterConnection.model().findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('allows a resend once the cooldown has passed and resets attempts', async () => {
    const stale = mockOtpDoc({ cooldownUntil: new Date(Date.now() - 1000), attempts: 3 });
    const { masterConnection, OtpCode } = mockMaster(stale);

    await otpService.sendOtp({ email: 'cliente@correo.com', masterConnection });

    const [, update] = OtpCode.findOneAndUpdate.mock.calls[0];
    expect(update.$set.attempts).toBe(0);
    expect(emailService.sendOtpCode).toHaveBeenCalledTimes(1);
  });

  test('defaults lang to es when not provided', async () => {
    const { masterConnection } = mockMaster(null);
    await otpService.sendOtp({ email: 'cliente@correo.com', masterConnection });
    expect(emailService.sendOtpCode).toHaveBeenCalledWith('cliente@correo.com', expect.any(String), 'es');
  });
});

describe('otpService.verifyOtp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('verifies the correct code and marks it single-use (verifiedAt)', async () => {
    const doc = mockOtpDoc();
    const { masterConnection } = mockMaster(doc);

    const result = await otpService.verifyOtp({ email: 'cliente@correo.com', code: '123456', masterConnection });

    expect(result).toEqual({ verified: true });
    expect(doc.verifiedAt).toBeInstanceOf(Date);
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test('rejects a wrong code, increments attempts, and does not verify', async () => {
    const doc = mockOtpDoc();
    const { masterConnection } = mockMaster(doc);

    await expect(otpService.verifyOtp({ email: 'cliente@correo.com', code: '000000', masterConnection }))
      .rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(doc.attempts).toBe(1);
    expect(doc.verifiedAt).toBeNull();
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test('invalidates the code after the 5th failed attempt', async () => {
    const doc = mockOtpDoc({ attempts: 4 });
    const { masterConnection } = mockMaster(doc);

    await expect(otpService.verifyOtp({ email: 'cliente@correo.com', code: '000000', masterConnection }))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(doc.attempts).toBe(5);

    // Even the correct code is now rejected: the code is invalidated
    const { masterConnection: mc2 } = mockMaster(doc);
    await expect(otpService.verifyOtp({ email: 'cliente@correo.com', code: '123456', masterConnection: mc2 }))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  test('rejects an expired code', async () => {
    const doc = mockOtpDoc({ expiresAt: new Date(Date.now() - 1000) });
    const { masterConnection } = mockMaster(doc);

    await expect(otpService.verifyOtp({ email: 'cliente@correo.com', code: '123456', masterConnection }))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('rejects an already verified (single-use) code', async () => {
    const doc = mockOtpDoc({ verifiedAt: new Date() });
    const { masterConnection } = mockMaster(doc);

    await expect(otpService.verifyOtp({ email: 'cliente@correo.com', code: '123456', masterConnection }))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('rejects an unknown email with no OTP record', async () => {
    const { masterConnection } = mockMaster(null);

    await expect(otpService.verifyOtp({ email: 'nadie@correo.com', code: '123456', masterConnection }))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

/**
 * Password-recovery purpose parameterization (forgot-password spec R3/R4,
 * design D5): keys become `${email}:${purpose}`, the purpose picks the email
 * template, and `dispatch:false` stages without emailing (anti-enumeration D3).
 */
describe('otpService purpose parameterization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('stages register and password_reset codes under distinct purpose keys', async () => {
    const { masterConnection, OtpCode } = mockMaster(null);

    await otpService.sendOtp({ email: 'cliente@correo.com', masterConnection });
    await otpService.sendOtp({ email: 'cliente@correo.com', masterConnection, purpose: 'password_reset' });

    expect(OtpCode.findOne.mock.calls.map((c) => c[0].key)).toEqual([
      'cliente@correo.com:register',
      'cliente@correo.com:password_reset',
    ]);
    const keys = OtpCode.findOneAndUpdate.mock.calls.map((c) => c[0].key);
    expect(keys).toEqual(['cliente@correo.com:register', 'cliente@correo.com:password_reset']);
    expect(keys[0]).not.toBe(keys[1]);
  });

  test('picks the email sender from the purpose: register -> sendOtpCode, password_reset -> sendPasswordResetOtp', async () => {
    const register = mockMaster(null);
    await otpService.sendOtp({ email: 'cliente@correo.com', lang: 'es', masterConnection: register.masterConnection });
    expect(emailService.sendOtpCode).toHaveBeenCalledTimes(1);
    expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();

    jest.clearAllMocks();
    const reset = mockMaster(null);
    await otpService.sendOtp({ email: 'cliente@correo.com', lang: 'fr', masterConnection: reset.masterConnection, purpose: 'password_reset' });
    expect(emailService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);
    expect(emailService.sendPasswordResetOtp).toHaveBeenCalledWith('cliente@correo.com', expect.stringMatching(/^\d{6}$/), 'fr');
    expect(emailService.sendOtpCode).not.toHaveBeenCalled();
  });

  test('dispatch:false stages the code, sends no email, and returns the SAME body as a dispatched send', async () => {
    const { masterConnection, OtpCode } = mockMaster(null);

    const result = await otpService.sendOtp({
      email: 'desconocido@correo.com',
      masterConnection,
      purpose: 'password_reset',
      dispatch: false,
    });

    // staged: upsert ran under the purpose key (unknown emails still get a
    // TTL'd record and identical cooldowns — design D3)
    expect(OtpCode.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(OtpCode.findOneAndUpdate.mock.calls[0][0]).toEqual({ key: 'desconocido@correo.com:password_reset' });
    // but nothing left the building
    expect(emailService.sendOtpCode).not.toHaveBeenCalled();
    expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();

    // identical generic body (anti-enumeration: known/unknown must deep-equal)
    jest.clearAllMocks();
    const dispatched = mockMaster(null);
    const known = await otpService.sendOtp({
      email: 'conocido@correo.com',
      masterConnection: dispatched.masterConnection,
      purpose: 'password_reset',
    });
    expect(result).toEqual(known);
  });

  test('a live password_reset cooldown blocks resends for THAT purpose key with 429', async () => {
    const recent = mockOtpDoc({ cooldownUntil: new Date(Date.now() + 30 * 1000) });
    const { masterConnection, OtpCode } = mockMaster(recent);

    await expect(
      otpService.sendOtp({ email: 'cliente@correo.com', masterConnection, purpose: 'password_reset' })
    ).rejects.toBeInstanceOf(TooManyRequestsException);

    // the cooldown lookup reads the purpose-scoped key, never the register one
    expect(OtpCode.findOne).toHaveBeenCalledWith({ key: 'cliente@correo.com:password_reset' });
    expect(emailService.sendPasswordResetOtp).not.toHaveBeenCalled();
    expect(OtpCode.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('verifyOtp reads the purpose-scoped record and leaves the other purpose untouched', async () => {
    const doc = mockOtpDoc();
    const { masterConnection, OtpCode } = mockMaster(doc);

    const result = await otpService.verifyOtp({
      email: 'cliente@correo.com',
      code: '123456',
      masterConnection,
      purpose: 'password_reset',
    });

    expect(result).toEqual({ verified: true });
    expect(OtpCode.findOne).toHaveBeenCalledWith({ key: 'cliente@correo.com:password_reset' });
    expect(OtpCode.findOne).not.toHaveBeenCalledWith({ key: 'cliente@correo.com:register' });
  });
});
