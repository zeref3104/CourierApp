/**
 * Integration tests for POST /client/device-token (client-mobile-app task 4.7,
 * push-notifications spec + design D11) against a real MongoDB test database:
 * - register a real client (OTP -> Customer + isClient User), then POST
 *   /client/device-token against the client's own User document
 * - returns 201 {registered:true, devices:n}
 * - re-submitting the SAME token is idempotent (no duplicate, devices unchanged)
 * - the 6th distinct token is rejected with 400 (cap of 5)
 * - a non-Expo token is rejected with 422 via the validation middleware
 *
 * Requires a reachable MongoDB (MONGO_URI from apps/api/.env). Uses dedicated
 * courier_test_devtoken_master / courier_test_devtoken_tenant databases (distinct
 * from the other integration files so parallel workers never collide), dropped
 * on setup.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const supertest = require('supertest');

// Bypass auth/rbac so the HTTP path is exercised without staff JWTs; the client
// route middleware below sets req.user.clientId + req.tenantModels directly.
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

const errorHandler = require('../../src/middlewares/errorHandler');
const authRoutes = require('../../src/modules/auth/auth.routes');
const clientRoutes = require('../../src/modules/client/client.routes');
const connectionManager = require('../../src/services/tenant/connectionManager');

const TEST_MASTER_DB = 'courier_test_devtoken_master';
const TEST_TENANT_DB = 'courier_test_devtoken_tenant';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

let masterConnection;
let tenantConnection;
let app;
let clientUserId;

async function makeCompany() {
  const Company = masterConnection.model('Company');
  return Company.create({
    name: 'Rapid Box',
    slug: `rb-${Math.random().toString(36).slice(2, 8)}`,
    email: 'info@rapidbox.co',
    clientCodePrefix: 'RB',
    databaseName: TEST_TENANT_DB,
    isActive: true,
    isSuspended: false,
  });
}

async function makeLicense(companyId) {
  const License = masterConnection.model('License');
  return License.create({
    companyId,
    planId: new mongoose.Types.ObjectId(),
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'trial',
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

/** Provision company + license + branch + role and register a real client. */
async function registerClient(email) {
  const company = await makeCompany();
  await makeLicense(company._id);
  await makeBranch();
  await makeClientRole();

  const send = await supertest(app).post('/auth/client/otp/send').send({ email, lang: 'es' });
  expect(send.status).toBe(200);

  const payload = {
    companyId: company._id.toString(),
    branchId: (await tenantConnection.model('Branch').findOne({}))._id.toString(),
    name: 'Cliente',
    lastName: 'Uno',
    phone: '8095551234',
    email,
    password: 'Passw0rd!',
    otpCode: mockLastOtpCode,
  };
  const res = await supertest(app).post('/auth/client/register').send(payload);
  expect(res.status).toBe(201);

  const User = tenantConnection.model('User');
  const user = await User.findOne({ email });
  expect(user).not.toBeNull();
  clientUserId = user._id.toString();
  return user;
}

/** Build the express app mounting /auth and /client (auth mocked open). */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.locals.masterConnection = masterConnection;
  app.use('/auth', authRoutes);
  app.use('/client', (req, res, next) => {
    req.user = { _id: clientUserId, clientId: 'cust-id', isClient: true };
    req.tenant = { id: 'company-1', slug: 'rapid-box', dbName: TEST_TENANT_DB };
    req.tenantModels = {
      Package: tenantConnection.model('Package'),
      PackageHistory: tenantConnection.model('PackageHistory'),
      Customer: tenantConnection.model('Customer'),
      Branch: tenantConnection.model('Branch'),
      User: tenantConnection.model('User'),
    };
    next();
  }, clientRoutes);
  app.use(errorHandler);
  return app;
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
  clientUserId = null;
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

describe('POST /client/device-token', () => {
  test('201: registers a token on the client User and reports device count', async () => {
    const email = 'devtoken@example.com';
    const user = await registerClient(email);

    const res = await supertest(app)
      .post('/client/device-token')
      .send({ token: 'ExponentPushToken[dev001]', platform: 'android' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ registered: true, devices: 1 });

    const updated = await tenantConnection.model('User').findById(user._id);
    expect(updated.deviceTokens).toHaveLength(1);
    expect(updated.deviceTokens[0].token).toBe('ExponentPushToken[dev001]');
    expect(updated.deviceTokens[0].platform).toBe('android');
  });

  test('re-submitting the SAME token is idempotent (devices unchanged)', async () => {
    const email = 'devtoken-dup@example.com';
    const user = await registerClient(email);

    const first = await supertest(app)
      .post('/client/device-token')
      .send({ token: 'ExponentPushToken[devdup]', platform: 'android' });
    expect(first.status).toBe(201);

    const second = await supertest(app)
      .post('/client/device-token')
      .send({ token: 'ExponentPushToken[devdup]', platform: 'ios' });
    expect(second.status).toBe(201);
    expect(second.body.data.devices).toBe(1);

    const updated = await tenantConnection.model('User').findById(user._id);
    expect(updated.deviceTokens).toHaveLength(1);
    expect(updated.deviceTokens[0].platform).toBe('ios'); // refreshed, not duplicated
  });

  test('400: a 6th distinct token is rejected (cap of 5 devices)', async () => {
    const email = 'devtoken-cap@example.com';
    await registerClient(email);

    for (let i = 1; i <= 5; i += 1) {
      const ok = await supertest(app)
        .post('/client/device-token')
        .send({ token: `ExponentPushToken[cap${i}]`, platform: 'android' });
      expect(ok.status).toBe(201);
    }

    const res = await supertest(app)
      .post('/client/device-token')
      .send({ token: 'ExponentPushToken[cap6]', platform: 'android' });
    expect(res.status).toBe(400);
  });

  test('422: a non-Expo token is rejected by the validation middleware', async () => {
    await registerClient('devtoken-invalid@example.com');

    const res = await supertest(app)
      .post('/client/device-token')
      .send({ token: 'fcm:APA91bToken123', platform: 'android' });
    expect(res.status).toBe(422);
  });
});
