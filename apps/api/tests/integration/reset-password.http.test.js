/**
 * Integration tests for POST /auth/reset-password (password-recovery spec,
 * tasks 3.4; design D1/D4/D6) against a real MongoDB test database:
 * - happy path: new password hashed, lockout + forced-change flag cleared,
 *   refresh-token chain nulled, OTP consumed AFTER the save (R5/R6)
 * - single-use: the consumed code is rejected on re-submit (R4)
 * - 5 wrong codes invalidate the OTP — even the correct one afterwards (R4)
 * - expired TTL rejected with the SAME generic message (R4/R1)
 * - a stolen refresh token (current AND rotated-out) dies with the reset (R6)
 * - a weak password is rejected 422 by zod with ZERO state touched (D1)
 * - an unresolvable email answers the identical generic 422 — never 404 — even
 *   when the request arrives on a non-localhost Host (public route, R1)
 *
 * Requires a reachable MongoDB (MONGO_URI from apps/api/.env). Uses dedicated
 * courier_test_reset_master / courier_test_reset_tenant databases (distinct
 * from the other integration files so parallel workers never collide), dropped
 * on setup and teardown.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const supertest = require('supertest');

// The recovery endpoints are public and pre-tenant: no staff JWT is involved.
jest.mock('../../src/middlewares/auth', () => (req, res, next) => next());

// Capture BOTH senders: register mails via sendOtpCode, forgot must use the
// dedicated sendPasswordResetOtp (template isolation).
let mockLastOtpCode = null;
const mockResetMails = [];
jest.mock('../../src/services/notifications/email.service', () => ({
  sendOtpCode: jest.fn(async (email, code) => {
    mockLastOtpCode = code;
    return { messageId: 'captured' };
  }),
  sendPasswordResetOtp: jest.fn(async (email, code, lang) => {
    mockResetMails.push({ email, code, lang });
    return { messageId: 'captured' };
  }),
}));

const errorHandler = require('../../src/middlewares/errorHandler');
const authRoutes = require('../../src/modules/auth/auth.routes');
const tenantResolver = require('../../src/middlewares/tenantResolver');
const { authLimiter } = require('../../src/middlewares/rateLimiter');
const connectionManager = require('../../src/services/tenant/connectionManager');

const TEST_MASTER_DB = 'courier_test_reset_master';
const TEST_TENANT_DB = 'courier_test_reset_tenant';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const RESET_URL = '/api/v1/auth/reset-password';
const FORGOT_URL = '/api/v1/auth/forgot-password';
const GENERIC_FAILURE = 'Invalid or expired code';
const ORIGINAL_PASSWORD = 'Passw0rd!';
const NEW_PASSWORD = 'NuevaClave!9';

// express-rate-limit keys by req.ip; the loopback address shape varies by OS.
// Every candidate is reset per test so forgot + refresh calls never bleed the
// shared 10/15 min bucket between scenarios.
const LOOPBACK_KEYS = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];

let masterConnection;
let tenantConnection;
let app;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function postReset(payload) {
  return supertest(app).post(RESET_URL).send(payload);
}

async function makeCompany({ prefix = 'RS' } = {}) {
  const Company = masterConnection.model('Company');
  return Company.create({
    name: 'Rapid Box',
    slug: `rs-${Math.random().toString(36).slice(2, 8)}`,
    email: 'info@rapidbox.co',
    clientCodePrefix: prefix,
    databaseName: TEST_TENANT_DB,
    isActive: true,
    isSuspended: false,
  });
}

async function makeLicense(companyId, { status = 'trial' } = {}) {
  const License = masterConnection.model('License');
  return License.create({
    companyId,
    planId: new mongoose.Types.ObjectId(),
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status,
  });
}

async function makeBranch() {
  const Branch = tenantConnection.model('Branch');
  return Branch.create({
    name: 'Main Branch',
    code: `BR${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    address: 'Av. Principal 123',
    isActive: true,
    isMainBranch: true,
  });
}

async function makeClientRole() {
  const Role = tenantConnection.model('Role');
  return Role.findOneAndUpdate(
    { code: 'client' },
    { $setOnInsert: { name: 'Cliente', description: 'Self-service client', permissions: [], isSystem: true } },
    { upsert: true, new: true }
  );
}

/**
 * Create a fully-provisioned registered client through the REAL flow
 * (company + license + branch + OTP -> Customer + isClient User + a live
 * refresh token), so the recovery path exercises the same state production has.
 */
async function registerClient(email) {
  const company = await makeCompany();
  await makeLicense(company._id);
  const branch = await makeBranch();
  await makeClientRole();

  const send = await supertest(app).post('/api/v1/auth/client/otp/send').send({ email, lang: 'es' });
  expect(send.status).toBe(200);

  const res = await supertest(app).post('/api/v1/auth/client/register').send({
    companyId: company._id.toString(),
    branchId: branch._id.toString(),
    name: 'Cliente',
    lastName: 'Uno',
    phone: '8095551234',
    email,
    password: ORIGINAL_PASSWORD,
    otpCode: mockLastOtpCode,
  });
  expect(res.status).toBe(201);
  expect(res.body.data.refreshToken).toBeTruthy();
  return { company, res };
}

/** Request a recovery code through the REAL endpoint (also enforces the floor). */
async function requestResetCode(email) {
  const res = await supertest(app).post(FORGOT_URL).send({ email, lang: 'es' });
  expect(res.status).toBe(200);
  const mail = mockResetMails[mockResetMails.length - 1];
  expect(mail).toBeDefined();
  expect(mail.email).toBe(email);
  return mail.code;
}

/** Insert a fresh password_reset OTP directly (bypasses the 60s cooldown). */
async function seedResetOtp(email, code, overrides = {}) {
  const OtpCode = masterConnection.model('OtpCode');
  return OtpCode.findOneAndUpdate(
    { key: `${email}:password_reset` },
    {
      $set: {
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        cooldownUntil: new Date(Date.now() - 1000),
        verifiedAt: null,
        consumedAt: null,
        ...overrides,
      },
    },
    { upsert: true, new: true }
  );
}

async function findClientUser(email) {
  return tenantConnection
    .model('User')
    .findOne({ email, isClient: true })
    .select('+password +refreshToken +previousRefreshTokenHash');
}

beforeAll(async () => {
  masterConnection = await mongoose.createConnection(`${MONGO_URI}/${TEST_MASTER_DB}`).asPromise();
  tenantConnection = await mongoose.createConnection(`${MONGO_URI}/${TEST_TENANT_DB}`).asPromise();

  await masterConnection.dropDatabase();
  await tenantConnection.dropDatabase();

  masterConnection.model('Company', require('../../src/models/master/Company'));
  masterConnection.model('CompanyCounter', require('../../src/models/master/CompanyCounter'));
  masterConnection.model('License', require('../../src/models/master/License'));
  masterConnection.model('Plan', require('../../src/models/master/Plan'));
  masterConnection.model('OtpCode', require('../../src/models/master/OtpCode'));
  masterConnection.model('SuperAdmin', require('../../src/models/master/SuperAdmin'));
  masterConnection.model('TenantUserIndex', require('../../src/models/master/TenantUserIndex'));
  // Needed by POST /auth/refresh (isBlacklisted) for the stolen-session scenario.
  masterConnection.model('BlacklistedToken', require('../../src/models/master/BlacklistedToken'));
  // The register flow indexes the client email → tenant (production registers
  // this in loaders/mongoose.js); without it the flow throws MissingSchemaError.
  masterConnection.model('ClientEmailIndex', require('../../src/models/master/ClientEmailIndex'));
  require('../../src/models/tenant/Customer')(tenantConnection);
  require('../../src/models/tenant/Branch')(tenantConnection);
  require('../../src/models/tenant/Role')(tenantConnection);
  require('../../src/models/tenant/User')(tenantConnection);

  // Real constraints (unique prefix/counter, unique email index, OTP TTL,
  // blacklist TTL) in place before the scenarios run.
  await Promise.all([
    masterConnection.model('Company').init(),
    masterConnection.model('CompanyCounter').init(),
    masterConnection.model('OtpCode').init(),
    masterConnection.model('BlacklistedToken').init(),
    masterConnection.model('ClientEmailIndex').init(),
    tenantConnection.model('Customer').init(),
    tenantConnection.model('Branch').init(),
    tenantConnection.model('Role').init(),
    tenantConnection.model('User').init(),
  ]);

  // Mirror production mounting (loaders/index.js): tenant resolver first, then routes.
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.locals.masterConnection = masterConnection;
  app.use('/api/v1', tenantResolver);
  app.use('/api/v1/auth', authRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  mockLastOtpCode = null;
  mockResetMails.length = 0;
  jest.clearAllMocks();
  await Promise.all(LOOPBACK_KEYS.map((key) => authLimiter.resetKey(key)));
  await Promise.all([
    masterConnection.model('Company').deleteMany({}),
    masterConnection.model('CompanyCounter').deleteMany({}),
    masterConnection.model('License').deleteMany({}),
    masterConnection.model('OtpCode').deleteMany({}),
    masterConnection.model('ClientEmailIndex').deleteMany({}),
    tenantConnection.model('Customer').deleteMany({}),
    tenantConnection.model('Branch').deleteMany({}),
    tenantConnection.model('Role').deleteMany({}),
    tenantConnection.model('User').deleteMany({}),
  ]);
});

afterAll(async () => {
  await connectionManager.closeAll().catch(() => {});
  await masterConnection.dropDatabase();
  await tenantConnection.dropDatabase();
  await masterConnection.close();
  await tenantConnection.close();
});

describe('POST /auth/reset-password', () => {
  test('200: saves the hashed password, clears lockout/forced-change, revokes the token chain and consumes the OTP', async () => {
    const email = 'reset-happy@example.com';
    await registerClient(email);

    // A locked account that also forces a password change (worst case for R5).
    await tenantConnection.model('User').updateOne(
      { email },
      { $set: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 30 * 60 * 1000), mustChangePassword: true } }
    );

    const code = await requestResetCode(email);
    const res = await postReset({ email, otpCode: code, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { reset: true },
      message: 'Password reset successful',
    });

    const user = await findClientUser(email);
    expect(await user.comparePassword(NEW_PASSWORD)).toBe(true);
    expect(await user.comparePassword(ORIGINAL_PASSWORD)).toBe(false);
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.mustChangePassword).toBe(false);
    expect(user.refreshToken).toBeNull();
    expect(user.previousRefreshTokenHash).toBeNull();

    const otp = await masterConnection.model('OtpCode').findOne({ key: `${email}:password_reset` });
    expect(otp.consumedAt).toBeInstanceOf(Date);
  });

  test('422: the consumed code is rejected on re-submit and the password stays as reset', async () => {
    const email = 'reset-single-use@example.com';
    await registerClient(email);
    const code = await requestResetCode(email);

    const first = await postReset({ email, otpCode: code, newPassword: NEW_PASSWORD });
    expect(first.status).toBe(200);

    const second = await postReset({ email, otpCode: code, newPassword: 'OtraClave!9' });
    expect(second.status).toBe(422);
    expect(second.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(second.body.error.message).toBe(GENERIC_FAILURE);

    const user = await findClientUser(email);
    expect(await user.comparePassword(NEW_PASSWORD)).toBe(true);
    expect(await user.comparePassword('OtraClave!9')).toBe(false);
  });

  test('422: 5 wrong codes invalidate the OTP — even the correct one afterwards', async () => {
    const email = 'reset-exhausted@example.com';
    await registerClient(email);
    const code = await requestResetCode(email);

    for (let i = 0; i < 5; i += 1) {
      const wrong = await postReset({ email, otpCode: '000000', newPassword: NEW_PASSWORD });
      expect(wrong.status).toBe(422);
      expect(wrong.body.error.message).toBe(GENERIC_FAILURE);
    }

    const exhausted = await postReset({ email, otpCode: code, newPassword: NEW_PASSWORD });
    expect(exhausted.status).toBe(422);
    expect(exhausted.body.error.message).toBe(GENERIC_FAILURE);

    // The account was never touched by the failed attempts.
    const user = await findClientUser(email);
    expect(await user.comparePassword(ORIGINAL_PASSWORD)).toBe(true);
    const otp = await masterConnection.model('OtpCode').findOne({ key: `${email}:password_reset` });
    expect(otp.consumedAt).toBeNull();
  });

  test('422: an expired OTP answers the identical generic message and changes nothing', async () => {
    const email = 'reset-expired@example.com';
    await registerClient(email);
    await seedResetOtp(email, '123456', { expiresAt: new Date(Date.now() - 1000) });

    const res = await postReset({ email, otpCode: '123456', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe(GENERIC_FAILURE);

    const user = await findClientUser(email);
    expect(await user.comparePassword(ORIGINAL_PASSWORD)).toBe(true);
    const otp = await masterConnection.model('OtpCode').findOne({ key: `${email}:password_reset` });
    expect(otp.consumedAt).toBeNull();
  });

  test('401: a stolen refresh token (current and rotated-out) dies with the reset', async () => {
    const email = 'reset-stolen@example.com';
    const { res: registered } = await registerClient(email);
    const initialToken = registered.body.data.refreshToken;

    // The session works BEFORE the reset — otherwise its rejection proves nothing.
    // /auth/refresh rotates via Set-Cookie (the body only carries the access token).
    const before = await supertest(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refreshToken=${initialToken}`);
    expect(before.status).toBe(200);
    const rotationCookie = (before.headers['set-cookie'] || []).find((cookie) =>
      cookie.startsWith('refreshToken=')
    );
    expect(rotationCookie).toBeTruthy();
    const currentToken = rotationCookie.split(';')[0].replace('refreshToken=', '');
    expect(currentToken).toBeTruthy();

    const code = await requestResetCode(email);
    const reset = await postReset({ email, otpCode: code, newPassword: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    // R6/D6: nulling the hashes kills BOTH the current and the rotated-out token.
    for (const stolen of [currentToken, initialToken]) {
      const rejected = await supertest(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refreshToken=${stolen}`);
      expect(rejected.status).toBe(401);
      expect(rejected.body.error.code).toBe('UNAUTHORIZED');
    }

    // And the account logs in again with the NEW password (fresh token pair).
    const login = await supertest(app)
      .post('/api/v1/auth/client/login')
      .send({ email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.refreshToken).toBeTruthy();
  }, 30000);

  test('422: a weak password is rejected by validation with ZERO state touched (OTP stays usable)', async () => {
    const email = 'reset-weak@example.com';
    await registerClient(email);
    const code = await requestResetCode(email);

    const res = await postReset({ email, otpCode: code, newPassword: '12345678' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'newPassword' })])
    );

    // D1: password-shape failures never reach the service — nothing mutated.
    const user = await findClientUser(email);
    expect(await user.comparePassword(ORIGINAL_PASSWORD)).toBe(true);
    const otp = await masterConnection.model('OtpCode').findOne({ key: `${email}:password_reset` });
    expect(otp.consumedAt).toBeNull();
    expect(otp.attempts).toBe(0);
  });

  test('422: an unresolvable email answers the identical generic message — never 404 — on a non-localhost Host', async () => {
    const res = await supertest(app)
      .post(RESET_URL)
      .set('Host', 'acme-courier.example.com')
      .send({ email: 'ghost@example.com', otpCode: '123456', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(res.body.error.message).toBe(GENERIC_FAILURE);
  });
});
