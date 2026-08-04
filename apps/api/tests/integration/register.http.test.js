/**
 * Integration tests for POST /auth/client/register (client-mobile-app tasks
 * 2.6/2.7) against a real MongoDB test database:
 * - full flow: OTP send -> register creates Customer (global {PREFIX}-{SEQ} via
 *   the master counter) + isClient User and returns auto-login tokens
 * - app flow: /otp/verify first, register with the same code still succeeds
 * - 409 duplicate email in the tenant, nothing extra persisted
 * - 422 invalid OTP, nothing persisted (attempt counter incremented)
 * - 404 inactive / suspended company / missing license / inactive branch
 *
 * The local Mongo is a STANDALONE node, so the tenant session transaction is
 * rejected and the register flow proves the design D8 compensating-rollback
 * path: Customer + User persist only when BOTH succeed.
 *
 * Requires a reachable MongoDB (MONGO_URI from apps/api/.env). Uses dedicated
 * courier_test_register_master / courier_test_register_tenant databases (distinct
 * from the other integration file so parallel workers never collide), dropped on setup.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const express = require('express');
const supertest = require('supertest');

// Bypass auth/rbac so the HTTP path is exercised without staff JWTs.
jest.mock('../../src/middlewares/auth', () => (req, res, next) => next());
jest.mock('../../src/middlewares/rbac', () => ({
  staffOnly: (req, res, next) => next(),
  authorizeSuperAdmin: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
  can: () => (req, res, next) => next(),
}));

// Capture the emailed OTP code so tests can submit the REAL code to register.
let mockLastOtpCode = null;
jest.mock('../../src/services/notifications/email.service', () => ({
  sendOtpCode: jest.fn(async (email, code) => {
    mockLastOtpCode = code;
    return { messageId: 'captured' };
  }),
}));

const errorHandler = require('../../src/middlewares/errorHandler');
const authRoutes = require('../../src/modules/auth/auth.routes');
const connectionManager = require('../../src/services/tenant/connectionManager');

const TEST_MASTER_DB = 'courier_test_register_master';
const TEST_TENANT_DB = 'courier_test_register_tenant';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

let masterConnection;
let tenantConnection;
let app;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function makeCompany({ prefix = 'RB', isActive = true, isSuspended = false } = {}) {
  const Company = masterConnection.model('Company');
  return Company.create({
    name: 'Rapid Box',
    slug: `rb-${Math.random().toString(36).slice(2, 8)}`,
    email: 'info@rapidbox.co',
    clientCodePrefix: prefix,
    databaseName: TEST_TENANT_DB,
    isActive,
    isSuspended,
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

async function makeBranch({ isActive = true } = {}) {
  const Branch = tenantConnection.model('Branch');
  return Branch.create({
    name: 'Main Branch',
    code: `BR${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    address: 'Av. Principal 123',
    isActive,
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

/** Insert a fresh OTP doc directly (bypasses the 60s send cooldown). Upserts so
 *  the previously-consumed doc for the same email is replaced (like sendOtp). */
async function seedOtp(email, code, overrides = {}) {
  const OtpCode = masterConnection.model('OtpCode');
  return OtpCode.findOneAndUpdate(
    { key: `${email}:register` },
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

function registerPayload(company, branch, email, extra = {}) {
  return {
    companyId: company._id.toString(),
    branchId: branch._id.toString(),
    name: 'Cliente',
    lastName: 'Uno',
    phone: '8095551234',
    email,
    password: 'Passw0rd!',
    otpCode: mockLastOtpCode || '123456',
    ...extra,
  };
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
  require('../../src/models/tenant/Customer')(tenantConnection);
  require('../../src/models/tenant/Branch')(tenantConnection);
  require('../../src/models/tenant/Role')(tenantConnection);
  require('../../src/models/tenant/User')(tenantConnection);

  // Build indexes so the real constraints (unique code, unique email, unique
  // counter, TTL) are in place before the scenarios run.
  await Promise.all([
    masterConnection.model('Company').init(),
    masterConnection.model('CompanyCounter').init(),
    masterConnection.model('OtpCode').init(),
    tenantConnection.model('Customer').init(),
    tenantConnection.model('Branch').init(),
    tenantConnection.model('Role').init(),
    tenantConnection.model('User').init(),
  ]);

  app = express();
  app.use(express.json());
  app.locals.masterConnection = masterConnection;
  app.use('/auth', authRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  mockLastOtpCode = null;
  await Promise.all([
    masterConnection.model('Company').deleteMany({}),
    masterConnection.model('CompanyCounter').deleteMany({}),
    masterConnection.model('License').deleteMany({}),
    masterConnection.model('OtpCode').deleteMany({}),
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

describe('POST /auth/client/register', () => {
  test('201: send OTP -> register creates Customer + isClient User and returns tokens', async () => {
    const company = await makeCompany({});
    await makeLicense(company._id);
    const branch = await makeBranch();
    await makeClientRole();
    const email = 'cliente@example.com';

    const sendRes = await supertest(app).post('/auth/client/otp/send').send({ email, lang: 'es' });
    expect(sendRes.status).toBe(200);
    expect(mockLastOtpCode).toMatch(/^\d{6}$/);

    const res = await supertest(app).post('/auth/client/register').send(registerPayload(company, branch, email));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.client.code).toBe('RB-000001');
    expect(res.body.data.client.name).toBe('Cliente');
    expect(res.body.data.client.email).toBe(email);

    const Customer = tenantConnection.model('Customer');
    const customer = await Customer.findOne({ email });
    expect(customer).not.toBeNull();
    expect(customer.code).toBe('RB-000001');
    expect(customer.branchId.toString()).toBe(branch._id.toString());

    const User = tenantConnection.model('User');
    const user = await User.findOne({ email }).select('+password');
    expect(user).not.toBeNull();
    expect(user.isClient).toBe(true);
    expect(user.clientId.toString()).toBe(customer._id.toString());
    expect(await user.comparePassword('Passw0rd!')).toBe(true);

    const counter = await masterConnection.model('CompanyCounter').findOne({ companyId: company._id });
    expect(counter.seq).toBe(1);

    const otp = await masterConnection.model('OtpCode').findOne({ key: `${email}:register` });
    expect(otp.consumedAt).toBeInstanceOf(Date);
  });

  test('201: app flow — OTP verified first, register with the same code still succeeds', async () => {
    const company = await makeCompany({});
    await makeLicense(company._id);
    const branch = await makeBranch();
    await makeClientRole();
    const email = 'app-flow@example.com';

    await supertest(app).post('/auth/client/otp/send').send({ email });
    const verifyRes = await supertest(app).post('/auth/client/otp/verify').send({
      email,
      code: mockLastOtpCode,
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.verified).toBe(true);

    const res = await supertest(app).post('/auth/client/register').send(registerPayload(company, branch, email));
    expect(res.status).toBe(201);
    expect(res.body.data.client.code).toBe('RB-000001');
  });

  test('409: duplicate email in the tenant is rejected and no second account persists', async () => {
    const company = await makeCompany({});
    await makeLicense(company._id);
    const branch = await makeBranch();
    await makeClientRole();
    const email = 'dup@example.com';

    await supertest(app).post('/auth/client/otp/send').send({ email });
    const first = await supertest(app).post('/auth/client/register').send(registerPayload(company, branch, email));
    expect(first.status).toBe(201);

    // Second attempt with a fresh code (direct insert skips the 60s cooldown)
    await seedOtp(email, '654321');
    const second = await supertest(app)
      .post('/auth/client/register')
      .send({ ...registerPayload(company, branch, email), otpCode: '654321' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');

    const Customer = tenantConnection.model('Customer');
    const User = tenantConnection.model('User');
    expect(await Customer.countDocuments({ email })).toBe(1);
    expect(await User.countDocuments({ email })).toBe(1);
  });

  test('422: invalid OTP aborts registration and persists nothing', async () => {
    const company = await makeCompany({});
    await makeLicense(company._id);
    const branch = await makeBranch();
    await makeClientRole();
    const email = 'invalid-otp@example.com';

    await supertest(app).post('/auth/client/otp/send').send({ email });
    const res = await supertest(app)
      .post('/auth/client/register')
      .send({ ...registerPayload(company, branch, email), otpCode: '000000' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');

    expect(await tenantConnection.model('Customer').countDocuments({ email })).toBe(0);
    expect(await tenantConnection.model('User').countDocuments({ email })).toBe(0);

    const otp = await masterConnection.model('OtpCode').findOne({ key: `${email}:register` });
    expect(otp.attempts).toBe(1);
  });

  test('404: inactive company rejects registration', async () => {
    const company = await makeCompany({ isActive: false });
    await makeLicense(company._id);
    const branch = await makeBranch();
    await makeClientRole();
    const email = 'inactive@example.com';

    await supertest(app).post('/auth/client/otp/send').send({ email });
    const res = await supertest(app).post('/auth/client/register').send(registerPayload(company, branch, email));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(await tenantConnection.model('Customer').countDocuments({})).toBe(0);
    expect(await tenantConnection.model('User').countDocuments({})).toBe(0);
  });

  test('404: suspended company rejects registration', async () => {
    const company = await makeCompany({ isSuspended: true });
    await makeLicense(company._id);
    const branch = await makeBranch();
    await makeClientRole();
    const email = 'suspended@example.com';

    await supertest(app).post('/auth/client/otp/send').send({ email });
    const res = await supertest(app).post('/auth/client/register').send(registerPayload(company, branch, email));

    expect(res.status).toBe(404);
    expect(await tenantConnection.model('Customer').countDocuments({})).toBe(0);
    expect(await tenantConnection.model('User').countDocuments({})).toBe(0);
  });

  test('404: company without a valid license rejects registration', async () => {
    const company = await makeCompany({});
    const branch = await makeBranch();
    await makeClientRole();
    const email = 'no-license@example.com';

    await supertest(app).post('/auth/client/otp/send').send({ email });
    const res = await supertest(app).post('/auth/client/register').send(registerPayload(company, branch, email));

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('Company license is not active');
    expect(await tenantConnection.model('Customer').countDocuments({})).toBe(0);
  });

  test('404: inactive branch rejects registration', async () => {
    const company = await makeCompany({});
    await makeLicense(company._id);
    const branch = await makeBranch({ isActive: false });
    await makeClientRole();
    const email = 'inactive-branch@example.com';

    await supertest(app).post('/auth/client/otp/send').send({ email });
    const res = await supertest(app).post('/auth/client/register').send(registerPayload(company, branch, email));

    expect(res.status).toBe(404);
    expect(await tenantConnection.model('Customer').countDocuments({})).toBe(0);
    expect(await tenantConnection.model('User').countDocuments({})).toBe(0);
  });
});
