/**
 * Integration tests for POST /auth/forgot-password (password-recovery spec,
 * tasks 3.3; design D3/D4/D5) against a real MongoDB test database:
 * - 200 parity: known vs unknown email answer DEEP-EQUAL bodies, only the
 *   unique match mails, and BOTH honor the fixed 300 ms response floor
 * - resend cooldown: a resend inside 60 s answers 429 TOO_MANY_REQUESTS with
 *   `resendAfter` — also for unknown emails, which stage WITHOUT dispatch
 * - disambiguation: ambiguous email -> 409 (exact clientLogin message, no OTP);
 *   the same email + correct global client code -> 200 + OTP
 * - purpose isolation: an existing `email:register` OTP stays untouched and
 *   still verifies after a forgot issued `email:password_reset`
 * - burst: the 11th request from one IP is throttled (authLimiter 10/15 min)
 * - public access: a non-localhost Host (unknown tenant slug) still answers 200
 *   (tenantResolver PUBLIC_ROUTES bypass)
 *
 * Requires a reachable MongoDB (MONGO_URI from apps/api/.env). Uses dedicated
 * courier_test_forgot_master / courier_test_forgot_tenant databases (distinct
 * from the other integration files so parallel workers never collide), dropped
 * on setup and teardown.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const supertest = require('supertest');

// The recovery endpoints are public and pre-tenant: no staff JWT is involved.
jest.mock('../../src/middlewares/auth', () => (req, res, next) => next());

// Capture BOTH senders so the test can prove which flow mailed the code:
// register keeps `sendOtpCode`, forgot MUST use the dedicated `sendPasswordResetOtp`.
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

const emailService = require('../../src/services/notifications/email.service');
const errorHandler = require('../../src/middlewares/errorHandler');
const authRoutes = require('../../src/modules/auth/auth.routes');
const tenantResolver = require('../../src/middlewares/tenantResolver');
const { authLimiter } = require('../../src/middlewares/rateLimiter');
const connectionManager = require('../../src/services/tenant/connectionManager');

const TEST_MASTER_DB = 'courier_test_forgot_master';
const TEST_TENANT_DB = 'courier_test_forgot_tenant';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const FORGOT_URL = '/api/v1/auth/forgot-password';
const MULTI_COMPANY_MESSAGE =
  'This email is linked to multiple companies. Sign in with your client code instead.';

// express-rate-limit keys by req.ip; supertest reports the loopback address in
// one of these shapes depending on the OS/IPv6 stack. Every candidate is reset
// per test so the shared 10/15 min bucket never leaks between scenarios.
const LOOPBACK_KEYS = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];

let masterConnection;
let tenantConnection;
let app;

function postForgot(payload) {
  return supertest(app).post(FORGOT_URL).send(payload);
}

async function makeCompany({ prefix = 'FR', dbName = TEST_TENANT_DB } = {}) {
  const Company = masterConnection.model('Company');
  return Company.create({
    name: 'Rapid Box',
    slug: `fr-${Math.random().toString(36).slice(2, 8)}`,
    email: 'info@rapidbox.co',
    clientCodePrefix: prefix,
    databaseName: dbName,
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

/** The register flow writes this index; seeded directly to keep each forgot
 *  scenario focused on the recovery behavior itself. */
async function seedIndex(email, companyId) {
  return masterConnection
    .model('ClientEmailIndex')
    .create({ email, companyId, isActive: true });
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
  // tenantResolver + register both need it (production registers it in loaders/mongoose.js).
  masterConnection.model('ClientEmailIndex', require('../../src/models/master/ClientEmailIndex'));
  require('../../src/models/tenant/Customer')(tenantConnection);
  require('../../src/models/tenant/Branch')(tenantConnection);
  require('../../src/models/tenant/Role')(tenantConnection);
  require('../../src/models/tenant/User')(tenantConnection);

  // Real constraints (unique prefix, unique email index, OTP TTL) before scenarios.
  await Promise.all([
    masterConnection.model('Company').init(),
    masterConnection.model('CompanyCounter').init(),
    masterConnection.model('OtpCode').init(),
    masterConnection.model('ClientEmailIndex').init(),
    tenantConnection.model('Customer').init(),
    tenantConnection.model('Branch').init(),
    tenantConnection.model('Role').init(),
    tenantConnection.model('User').init(),
  ]);

  // Mirror production mounting (loaders/index.js): tenant resolver first, then routes.
  app = express();
  app.use(express.json());
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

describe('POST /auth/forgot-password', () => {
  test('200: known and unknown emails answer deep-equal bodies; only the known one mails; both honor the 300 ms floor', async () => {
    const company = await makeCompany({ prefix: 'FR' });
    await makeLicense(company._id);
    const knownEmail = 'known@example.com';
    await seedIndex(knownEmail, company._id);
    const unknownEmail = 'unknown@example.com';

    const knownStart = Date.now();
    const known = await postForgot({ email: knownEmail, lang: 'es' });
    const knownElapsed = Date.now() - knownStart;

    const unknownStart = Date.now();
    const unknown = await postForgot({ email: unknownEmail });
    const unknownElapsed = Date.now() - unknownStart;

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual({
      success: true,
      data: { sent: true, resendAfter: 60 },
      message: expect.any(String),
    });
    // R1: the answer to an unknown email is byte-identical (anti-enumeration).
    expect(unknown.body).toEqual(known.body);

    // Only the unique match dispatched, and it used the reset sender/template.
    expect(mockResetMails).toHaveLength(1);
    expect(mockResetMails[0].email).toBe(knownEmail);
    expect(mockResetMails[0].code).toMatch(/^\d{6}$/);
    expect(mockResetMails[0].lang).toBe('es');
    expect(emailService.sendOtpCode).not.toHaveBeenCalled();

    // D3: fixed 300 ms floor on BOTH paths.
    expect(knownElapsed).toBeGreaterThanOrEqual(300);
    expect(unknownElapsed).toBeGreaterThanOrEqual(300);

    // The unknown email still staged a TTL'd record (identical cooldown semantics).
    const staged = await masterConnection
      .model('OtpCode')
      .findOne({ key: `${unknownEmail}:password_reset` });
    expect(staged).not.toBeNull();
    expect(staged.expiresAt.getTime()).toBeGreaterThan(Date.now());
    // Hashed at rest — the staged code is never stored in plaintext.
    expect(staged.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(staged.cooldownUntil.getTime()).toBeGreaterThan(Date.now());
  });

  test('429: a resend inside the 60 s cooldown is rejected — also for unknown emails staged without dispatch', async () => {
    const email = 'cooldown@example.com';

    const first = await postForgot({ email });
    expect(first.status).toBe(200);
    expect(mockResetMails).toHaveLength(0); // unknown -> staged, no mail

    const resendStart = Date.now();
    const second = await postForgot({ email });
    const resendElapsed = Date.now() - resendStart;

    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(second.body.error.details.resendAfter).toBeGreaterThan(0);
    expect(second.body.error.details.resendAfter).toBeLessThanOrEqual(60);
    // The floor holds on the error path too: timing stays constant (D3).
    expect(resendElapsed).toBeGreaterThanOrEqual(300);
    expect(mockResetMails).toHaveLength(0);
  });

  test('409 without a client code / 200 + OTP with the resolving code (ambiguous email)', async () => {
    const companyA = await makeCompany({ prefix: 'AAA' });
    // `Company.databaseName` is unique (one database per company), and recovery
    // never opens the second company's tenant — only the code's company is
    // resolved — so B points at its own (never-connected) database.
    const companyB = await makeCompany({ prefix: 'BBB', dbName: 'courier_test_forgot_unused' });
    await makeLicense(companyA._id);
    await makeLicense(companyB._id);
    const email = 'multi@example.com';
    await seedIndex(email, companyA._id);
    await seedIndex(email, companyB._id);

    const conflicted = await postForgot({ email });
    expect(conflicted.status).toBe(409);
    expect(conflicted.body.error.code).toBe('CONFLICT');
    expect(conflicted.body.error.message).toBe(MULTI_COMPANY_MESSAGE);
    // No OTP leaves (and none is staged) for an ambiguous email.
    expect(mockResetMails).toHaveLength(0);
    expect(await masterConnection.model('OtpCode').countDocuments({})).toBe(0);

    const resolved = await postForgot({ email, code: 'AAA-000001' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toEqual({ sent: true, resendAfter: 60 });
    expect(mockResetMails).toHaveLength(1);
    expect(mockResetMails[0].email).toBe(email);
  });

  test('purpose isolation: forgot issues email:password_reset and leaves the register OTP untouched', async () => {
    const company = await makeCompany({ prefix: 'ISO' });
    await makeLicense(company._id);
    const email = 'isolation@example.com';
    await seedIndex(email, company._id);

    // A register OTP already exists for this email (sent by /client/otp/send).
    const send = await supertest(app)
      .post('/api/v1/auth/client/otp/send')
      .send({ email, lang: 'es' });
    expect(send.status).toBe(200);
    const registerCode = mockLastOtpCode;
    expect(registerCode).toMatch(/^\d{6}$/);

    const registerBefore = await masterConnection
      .model('OtpCode')
      .findOne({ key: `${email}:register` });
    const registerHashBefore = registerBefore.codeHash;

    const forgot = await postForgot({ email });
    expect(forgot.status).toBe(200);
    expect(mockResetMails).toHaveLength(1);
    expect(emailService.sendOtpCode).toHaveBeenCalledTimes(1);

    // Distinct records: the reset code never overwrites or cools down the register one.
    const [registerAfter, resetDoc] = await Promise.all([
      masterConnection.model('OtpCode').findOne({ key: `${email}:register` }),
      masterConnection.model('OtpCode').findOne({ key: `${email}:password_reset` }),
    ]);
    expect(resetDoc).not.toBeNull();
    expect(resetDoc.codeHash).not.toBe(registerAfter.codeHash);
    expect(registerAfter.codeHash).toBe(registerHashBefore);
    expect(registerAfter.attempts).toBe(0);
    expect(registerAfter.consumedAt).toBeNull();

    // The register flow still verifies with its ORIGINAL code after the forgot.
    const verify = await supertest(app)
      .post('/api/v1/auth/client/otp/verify')
      .send({ email, code: registerCode });
    expect(verify.status).toBe(200);
    expect(verify.body.data.verified).toBe(true);
  });

  test('burst: the 11th forgot-password request from one IP is throttled by the auth limiter', async () => {
    const responses = [];
    for (let i = 0; i < 11; i += 1) {
      // Fresh email per probe: no OTP cooldown interferes with the limiter count.
      responses.push(await postForgot({ email: `burst-${i}@example.com` }));
    }

    expect(responses[0].status).toBe(200); // fresh bucket after the per-test reset
    for (const res of responses.slice(0, 10)) {
      expect(res.status).toBe(200);
    }
    expect(responses[10].status).toBe(429);
    expect(responses[10].body.error.code).toBe('RATE_LIMIT');
  }, 45000);

  test('public route: a non-localhost Host (unknown tenant slug) still answers 200 — no tenant resolution', async () => {
    const res = await supertest(app)
      .post(FORGOT_URL)
      .set('Host', 'acme-courier.example.com')
      .send({ email: 'bypass@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sent: true, resendAfter: 60 });
    expect(mockResetMails).toHaveLength(0);
  });
});
