/**
 * Integration tests for slice 3 code login + body refresh + client-panel
 * amount-to-pay gating at the HTTP level (client-mobile-app tasks 3.7, design
 * D9/D10/D13) against a real MongoDB test database:
 * - POST /auth/client/login: full register setup -> code login success returns
 *   accessToken + refreshToken + client {id, code, name, company:{slug,name,prefix}};
 *   a wrong password is rejected with 401
 * - POST /auth/client/refresh (body token): the returned refresh token rotates
 *   (new access + refresh tokens in the BODY); replaying the OLD token afterwards
 *   is detected as a replay -> ALL the client tokens are revoked and 401 returned
 * - GET /client/packages/:tracking: a `disponible` package exposes amountToPay +
 *   pickupBranch; an `en_reparto` package exposes NO amountToPay and NO total
 *
 * The register flow (company + license + branch + OTP -> Customer + isClient
 * User) is reused from the existing register.http.test.js helpers so we never
 * hand-build the Customer/User pair. Requires a reachable MongoDB (MONGO_URI
 * from apps/api/.env). Uses dedicated courier_test_login_master /
 * courier_test_login_tenant databases, dropped on setup and torn down on exit.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const supertest = require('supertest');

// Bypass auth/rbac so the HTTP client routes run without JWTs; the client route
// middleware sets req.user.clientId + req.tenantModels directly.
jest.mock('../../src/middlewares/auth', () => (req, res, next) => next());
jest.mock('../../src/middlewares/rbac', () => ({
  staffOnly: (req, res, next) => next(),
  authorizeSuperAdmin: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
  can: () => (req, res, next) => next(),
}));

// Capture the emailed OTP code so the register flow uses the REAL code.
let mockLastOtpCode = null;
jest.mock('../../src/services/notifications/email.service', () => ({
  sendOtpCode: jest.fn(async (email, code) => {
    mockLastOtpCode = code;
    return { messageId: 'captured' };
  }),
}));

// The BlacklistedToken master model declares BOTH `index: true` and an explicit
// TTL `schema.index({expiresAt:1}, {expireAfterSeconds:0})`, which collide when
// mongoose builds the index (pre-existing model bug, out of scope here). The
// HTTP-level refresh behavior under test is the rotation + replay revocation on
// the User doc, so blacklist persistence is mocked out instead.
jest.mock('../../src/modules/auth/token.service', () => {
  const crypto = require('crypto');
  return {
    generateRefreshToken: () => crypto.randomBytes(40).toString('hex'),
    hashToken: (token) => crypto.createHash('sha256').update(token).digest('hex'),
    rotate: (user, newToken) => {
      user.previousRefreshTokenHash = user.refreshToken || null;
      user.refreshToken = crypto.createHash('sha256').update(newToken).digest('hex');
    },
    isReplay: () => false,
    isBlacklisted: jest.fn(async () => false),
    blacklist: jest.fn(async () => {}),
  };
});

const errorHandler = require('../../src/middlewares/errorHandler');
const authRoutes = require('../../src/modules/auth/auth.routes');
const clientRoutes = require('../../src/modules/client/client.routes');
const connectionManager = require('../../src/services/tenant/connectionManager');

const TEST_MASTER_DB = 'courier_test_login_master';
const TEST_TENANT_DB = 'courier_test_login_tenant';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

let masterConnection;
let tenantConnection;
let app;
let customerId;
let branchId;

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

/** Create a fully-provisioned registered client via the real /auth/client/register flow. */
async function registerClient(email) {
  const company = await makeCompany();
  await makeLicense(company._id);
  const branch = await makeBranch();
  await makeClientRole();

  const send = await supertest(app).post('/auth/client/otp/send').send({ email, lang: 'es' });
  expect(send.status).toBe(200);

  const payload = {
    companyId: company._id.toString(),
    branchId: branch._id.toString(),
    name: 'Cliente',
    lastName: 'Uno',
    phone: '8095551234',
    email,
    password: 'Passw0rd!',
    otpCode: mockLastOtpCode,
  };
  const res = await supertest(app).post('/auth/client/register').send(payload);
  expect(res.status).toBe(201);

  const Customer = tenantConnection.model('Customer');
  const customer = await Customer.findOne({ email });
  expect(customer).not.toBeNull();
  customerId = customer._id;
  branchId = branch._id;
  return { company, customer, res };
}

/** Build the express app that mounts BOTH /auth and the client panel routes. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.locals.masterConnection = masterConnection;
  app.use('/auth', authRoutes);
  app.use('/client', (req, res, next) => {
    req.user = { _id: 'client-user-1', clientId: customerId, isClient: true };
    req.tenant = { id: 'company-1', slug: 'rapid-box', dbName: TEST_TENANT_DB };
    req.tenantModels = {
      Package: tenantConnection.model('Package'),
      PackageHistory: tenantConnection.model('PackageHistory'),
      Customer: tenantConnection.model('Customer'),
      Branch: tenantConnection.model('Branch'),
    };
    next();
  }, clientRoutes);
  app.use(errorHandler);
  return app;
}

async function seedPackage({ status, total = 50, tracking }) {
  const Package = tenantConnection.model('Package');
  return Package.create({
    tracking,
    customerId,
    status,
    total,
    weight: 2.5,
    description: 'Test package',
    branchId,
  });
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
  require('../../src/models/tenant/Customer')(tenantConnection);
  require('../../src/models/tenant/Branch')(tenantConnection);
  require('../../src/models/tenant/Role')(tenantConnection);
  require('../../src/models/tenant/User')(tenantConnection);
  require('../../src/models/tenant/Package')(tenantConnection);
  require('../../src/models/tenant/PackageHistory')(tenantConnection);

  await Promise.all([
    masterConnection.model('Company').init(),
    masterConnection.model('CompanyCounter').init(),
    masterConnection.model('OtpCode').init(),
    tenantConnection.model('Customer').init(),
    tenantConnection.model('Branch').init(),
    tenantConnection.model('Role').init(),
    tenantConnection.model('User').init(),
    tenantConnection.model('Package').init(),
    tenantConnection.model('PackageHistory').init(),
  ]);

  app = buildApp();
});

beforeEach(async () => {
  mockLastOtpCode = null;
  customerId = null;
  branchId = null;
  await Promise.all([
    masterConnection.model('Company').deleteMany({}),
    masterConnection.model('CompanyCounter').deleteMany({}),
    masterConnection.model('License').deleteMany({}),
    masterConnection.model('OtpCode').deleteMany({}),
    tenantConnection.model('Customer').deleteMany({}),
    tenantConnection.model('Branch').deleteMany({}),
    tenantConnection.model('Role').deleteMany({}),
    tenantConnection.model('User').deleteMany({}),
    tenantConnection.model('Package').deleteMany({}),
    tenantConnection.model('PackageHistory').deleteMany({}),
  ]);
});

afterAll(async () => {
  await connectionManager.closeAll().catch(() => {});
  await masterConnection.dropDatabase();
  await tenantConnection.dropDatabase();
  await masterConnection.close();
  await tenantConnection.close();
});

describe('POST /auth/client/login (code login)', () => {
  test('200: registered code + password logs in and returns tokens + client info', async () => {
    const email = 'cliente-login@example.com';
    const { customer } = await registerClient(email);

    const res = await supertest(app)
      .post('/auth/client/login')
      .send({ code: customer.code, password: 'Passw0rd!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.client.id).toBe(customer._id.toString());
    expect(res.body.data.client.code).toBe(customer.code);
    expect(res.body.data.client.name).toBe('Cliente');
    expect(res.body.data.client.company).toEqual(
      expect.objectContaining({ slug: expect.any(String), name: 'Rapid Box', prefix: 'RB' })
    );

    // the isClient User's refresh token was stored (hash) for the body refresh
    const User = tenantConnection.model('User');
    const user = await User.findOne({ email }).select('+refreshToken');
    expect(user.refreshToken).toBeTruthy();
    expect(user.isClient).toBe(true);
  });

  test('401: wrong password is rejected', async () => {
    const email = 'cliente-wrongpw@example.com';
    const { customer } = await registerClient(email);

    const res = await supertest(app)
      .post('/auth/client/login')
      .send({ code: customer.code, password: 'WrongPass1!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('POST /auth/client/refresh (body refresh + replay detection)', () => {
  test('200: a returned refresh token rotates but replaying the OLD token revokes ALL client tokens', async () => {
    const email = 'cliente-refresh@example.com';
    const { customer } = await registerClient(email);

    // 1. Code login returns a body refresh token.
    const login = await supertest(app)
      .post('/auth/client/login')
      .send({ code: customer.code, password: 'Passw0rd!' });
    expect(login.status).toBe(200);
    const refreshToken = login.body.data.refreshToken;

    // 2. Refresh with the CURRENT token -> new access + refresh in the body.
    const refresh = await supertest(app)
      .post('/auth/client/refresh')
      .send({ refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toBeTruthy();
    expect(refresh.body.data.refreshToken).toBeTruthy();
    expect(refresh.body.data.refreshToken).not.toBe(refreshToken);

    const User = tenantConnection.model('User');
    const afterRefresh = await User.findOne({ email }).select('+refreshToken +previousRefreshTokenHash');
    // rotation moved the consumed hash to previous
    expect(afterRefresh.previousRefreshTokenHash).toBeTruthy();

    // 3. Replay the OLD refresh token -> replay detected, ALL client tokens revoked.
    const replay = await supertest(app)
      .post('/auth/client/refresh')
      .send({ refreshToken });
    expect([401, 403]).toContain(replay.status);

    const afterReplay = await User.findOne({ email }).select('+refreshToken +previousRefreshTokenHash');
    expect(afterReplay.refreshToken).toBeNull();
    expect(afterReplay.previousRefreshTokenHash).toBeNull();
  });
});

describe('GET /client/packages/:tracking (amountToPay gating)', () => {
  test('disponible: exposes amountToPay + pickupBranch', async () => {
    const email = 'cliente-amount@example.com';
    await registerClient(email);
    await seedPackage({ status: 'disponible', total: 123.45, tracking: 'CPR-DISPONIBLE-1' });

    const res = await supertest(app).get('/client/packages/CPR-DISPONIBLE-1');

    expect(res.status).toBe(200);
    expect(res.body.data.amountToPay).toBe(123.45);
    expect(res.body.data.pickupBranch).toEqual(
      expect.objectContaining({ name: 'Main Branch', address: 'Av. Principal 123' })
    );
    // the raw amount field is still exposed alongside amountToPay for disponible
    expect(res.body.data.total).toBe(123.45);
  });

  test('en_reparto: exposes NO amountToPay and NO total', async () => {
    const email = 'cliente-noamount@example.com';
    await registerClient(email);
    await seedPackage({ status: 'en_reparto', total: 999.99, tracking: 'CPR-ENREPARTO-2' });

    const res = await supertest(app).get('/client/packages/CPR-ENREPARTO-2');

    expect(res.status).toBe(200);
    expect('amountToPay' in res.body.data).toBe(false);
    expect('total' in res.body.data).toBe(false);
    expect('cost' in res.body.data).toBe(false);
  });
});