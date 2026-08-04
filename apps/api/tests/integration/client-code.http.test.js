/**
 * Integration tests for the global client code HTTP path (client-code-identity
 * spec, task 1.14) against a real MongoDB test database:
 * - staff POST /customers mints {PREFIX}-{SEQ:6} via the master CompanyCounter
 * - 25 concurrent POST /customers yield 25 DISTINCT sequential codes (the
 *   atomicity/concurrency scenario deferred in the PR 1a verification)
 * - POST /superadmin/companies rejects a duplicate prefix with 409 at the HTTP layer
 * - migrateClientCodes backfills CUS- codes to RB-000001..3, is idempotent,
 *   leaves no CUS- codes, and dry-run writes nothing
 *
 * Requires a reachable MongoDB (MONGO_URI from apps/api/.env). Uses dedicated
 * courier_test_master / courier_test_tenant databases, dropped on setup.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const supertest = require('supertest');

// Replace auth/rbac/connectionManager so the HTTP path runs against the real
// master counter without JWT/tenant-DB provisioning (slice 2/3 scope).
jest.mock('../../src/middlewares/auth', () => (req, res, next) => next());
jest.mock('../../src/middlewares/rbac', () => ({
  staffOnly: (req, res, next) => next(),
  authorizeSuperAdmin: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
  can: () => (req, res, next) => next(),
}));
jest.mock('../../src/services/tenant/connectionManager', () => ({
  getConnection: jest.fn(),
}));

const errorHandler = require('../../src/middlewares/errorHandler');
const customerRoutes = require('../../src/modules/customers/customer.routes');
const companyRoutes = require('../../src/modules/companies/company.routes');
const { migrateClientCodes } = require('../../scripts/migrate-client-codes');

const TEST_MASTER_DB = 'courier_test_master';
const TEST_TENANT_DB = 'courier_test_tenant';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const BRANCH_ID = '507f1f77bcf86cd799439011';

const CUSTOMER_PAYLOAD = {
  name: 'Juan',
  lastName: 'Perez',
  phone: '8095551234',
  email: 'juan@example.co',
};

let masterConnection;
let tenantConnection;

function buildApp({ company }) {
  const app = express();
  app.use(express.json());
  app.locals.masterConnection = masterConnection;
  app.use((req, res, next) => {
    req.tenant = {
      id: company ? company._id : null,
      slug: company ? company.slug : 'test',
      dbName: TEST_TENANT_DB,
      clientCodePrefix: company ? company.clientCodePrefix : undefined,
    };
    req.user = {
      _id: 'staff-1',
      email: 'staff@courier.app',
      role: 'admin',
      isClient: false,
      isSuperAdmin: true,
      branchId: BRANCH_ID,
    };
    req.tenantModels = {
      Customer: tenantConnection.model('Customer'),
      Branch: tenantConnection.model('Branch'),
      Counter: tenantConnection.model('Counter'),
    };
    next();
  });
  app.use('/superadmin', companyRoutes);
  app.use('/customers', customerRoutes);
  app.use(errorHandler);
  return app;
}

function makeCompany(data = {}) {
  const Company = masterConnection.model('Company');
  return Company.create({
    name: data.name || 'Test Company',
    slug: data.slug || `test-${Math.random().toString(36).slice(2, 8)}`,
    email: data.email || 'info@test.co',
    clientCodePrefix: data.clientCodePrefix,
    databaseName: TEST_TENANT_DB,
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
  require('../../src/models/tenant/Customer')(tenantConnection);
  require('../../src/models/tenant/Branch')(tenantConnection);
  require('../../src/models/tenant/Counter')(tenantConnection);

  // Build indexes (sparse unique prefix, unique companyId, unique code) so the
  // real constraints are in place before the concurrency scenarios run.
  await Promise.all([
    masterConnection.model('Company').init(),
    masterConnection.model('CompanyCounter').init(),
    tenantConnection.model('Customer').init(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    masterConnection.model('Company').deleteMany({}),
    masterConnection.model('CompanyCounter').deleteMany({}),
    masterConnection.model('License').deleteMany({}),
    tenantConnection.model('Customer').deleteMany({}),
  ]);
});

afterAll(async () => {
  await masterConnection.dropDatabase();
  await tenantConnection.dropDatabase();
  await masterConnection.close();
  await tenantConnection.close();
});

describe('staff POST /customers mints global client codes (HTTP)', () => {
  test('returns 201 with a {PREFIX}-{SEQ} code and advances the master counter', async () => {
    const company = await makeCompany({ name: 'One Way', slug: 'one-way', clientCodePrefix: 'OWY' });
    const app = buildApp({ company });

    const res = await supertest(app).post('/customers').send(CUSTOMER_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('OWY-000001');
    const counter = await masterConnection.model('CompanyCounter').findOne({ companyId: company._id });
    expect(counter.seq).toBe(1);
  });

  test('allocates 25 distinct sequential codes under 25 concurrent creations', async () => {
    // Spec "Atomic sequence allocation": two (here 25) concurrent creations for
    // the same company must each receive a distinct sequence number.
    const company = await makeCompany({ name: 'Concurrent', slug: 'concurrent', clientCodePrefix: 'CON' });
    const app = buildApp({ company });

    const responses = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        // Unique email per request: the service rejects duplicate emails with
        // 409, which would otherwise mask the code-allocation scenario.
        supertest(app).post('/customers').send({ ...CUSTOMER_PAYLOAD, email: `juan${i}@example.co` })
      )
    );

    expect(responses.every((r) => r.status === 201)).toBe(true);
    const codes = responses.map((r) => r.body.data.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(25);
    const sorted = [...codes].sort();
    const expected = Array.from({ length: 25 }, (_, i) => `CON-${String(i + 1).padStart(6, '0')}`);
    expect(sorted).toEqual(expected);
    const counter = await masterConnection.model('CompanyCounter').findOne({ companyId: company._id });
    expect(counter.seq).toBe(25);
  });
});

describe('POST /superadmin/companies rejects a duplicate client code prefix (HTTP)', () => {
  test('returns 409 CONFLICT when the prefix is already in use', async () => {
    await makeCompany({ name: 'First', slug: 'first-co', clientCodePrefix: 'DUP' });
    const app = buildApp({ company: null });

    const res = await supertest(app)
      .post('/superadmin/companies')
      .send({
        name: 'Second',
        slug: 'second-co',
        email: 'info@second.co',
        adminEmail: 'admin@second.co',
        clientCodePrefix: 'DUP',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('migrateClientCodes (integration)', () => {
  test('backfills CUS-0001..3 to RB-000001..3, is idempotent, leaves no CUS- codes', async () => {
    const company = await makeCompany({ name: 'Rapid Box', slug: 'rapid-box' });
    const Customer = tenantConnection.model('Customer');
    await Customer.create([
      { code: 'CUS-0001', name: 'Ada', lastName: 'One', phone: '8095551001', createdAt: new Date(2024, 0, 1) },
      { code: 'CUS-0002', name: 'Bob', lastName: 'Two', phone: '8095551002', createdAt: new Date(2024, 0, 2) },
      { code: 'CUS-0003', name: 'Cid', lastName: 'Three', phone: '8095551003', createdAt: new Date(2024, 0, 3) },
    ]);

    const silentLog = { info: () => {} };
    const stats = await migrateClientCodes({
      masterConnection,
      getTenantConnection: () => tenantConnection,
      dryRun: false,
      log: silentLog,
    });

    expect(stats.prefixesAssigned).toBe(1);
    expect(stats.codesRewritten).toBe(3);
    const refreshed = await masterConnection.model('Company').findById(company._id);
    expect(refreshed.clientCodePrefix).toBe('RB');
    const customers = await Customer.find({}).sort({ createdAt: 1 });
    expect(customers.map((c) => c.code)).toEqual(['RB-000001', 'RB-000002', 'RB-000003']);
    const counter = await masterConnection.model('CompanyCounter').findOne({ companyId: company._id });
    expect(counter.seq).toBe(3);

    // Idempotent re-run: nothing rewritten, nothing reassigned, counter stable.
    const stats2 = await migrateClientCodes({
      masterConnection,
      getTenantConnection: () => tenantConnection,
      dryRun: false,
      log: silentLog,
    });
    expect(stats2.prefixesAssigned).toBe(0);
    expect(stats2.codesRewritten).toBe(0);
    const after = await Customer.find({});
    expect(after.every((c) => !/^CUS-/.test(c.code))).toBe(true);
    const counter2 = await masterConnection.model('CompanyCounter').findOne({ companyId: company._id });
    expect(counter2.seq).toBe(3);
  });

  test('dry-run reports changes without writing anything or consuming sequences', async () => {
    const company = await makeCompany({ name: 'Dry Corp', slug: 'dry-corp' });
    const Customer = tenantConnection.model('Customer');
    await Customer.create([
      { code: 'CUS-0007', name: 'Eve', lastName: 'Seven', phone: '8095551007', createdAt: new Date(2024, 1, 1) },
      { code: 'CUS-0008', name: 'Fay', lastName: 'Eight', phone: '8095551008', createdAt: new Date(2024, 1, 2) },
    ]);

    const stats = await migrateClientCodes({
      masterConnection,
      getTenantConnection: () => tenantConnection,
      dryRun: true,
      log: { info: () => {} },
    });

    expect(stats.prefixesAssigned).toBe(1);
    expect(stats.codesRewritten).toBe(2);

    const companyAfter = await masterConnection.model('Company').findById(company._id);
    expect(companyAfter.clientCodePrefix).toBeUndefined();
    const counter = await masterConnection.model('CompanyCounter').findOne({ companyId: company._id });
    expect(counter).toBeNull();
    const customers = await Customer.find({}).sort({ createdAt: 1 });
    expect(customers.map((c) => c.code)).toEqual(['CUS-0007', 'CUS-0008']);
  });
});
