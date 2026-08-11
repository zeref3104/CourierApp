/**
 * Integration tests for the public registration-lookup endpoints
 * (client-mobile-app task 2.9 / client-registration spec):
 * - GET /public/companies             -> ONLY active + licensed companies
 *   with a clientCodePrefix (registration-capable only),
 *   minimal DTO { id, slug, name } — no license/plan/internal leakage
 * - GET /public/companies/:id/branches -> ONLY active branches of an
 *   active + licensed company, DTO { id, name, address }; 404 for unknown,
 *   malformed, inactive or unlicensed companies
 *
 * Uses dedicated courier_test_public_master / courier_test_public_tenant
 * databases (distinct from every other integration file so parallel workers
 * never collide), dropped on setup and torn down on exit.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const supertest = require('supertest');

const errorHandler = require('../../src/middlewares/errorHandler');
const publicRoutes = require('../../src/modules/public/public.routes');
const connectionManager = require('../../src/services/tenant/connectionManager');

const TEST_MASTER_DB = 'courier_test_public_master';
const TEST_TENANT_DB = 'courier_test_public_tenant';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

let masterConnection;
let tenantConnection;
let app;

async function makeCompany({ prefix, isActive = true, isSuspended = false, dbName } = {}) {
  const Company = masterConnection.model('Company');
  // clientCodePrefix is unique-indexed: default to a random 5-letter prefix so
  // multiple companies in the same test never collide.
  const generatedPrefix =
    prefix ||
    `RB${Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('')}`;
  return Company.create({
    name: 'Rapid Box',
    slug: `rb-${Math.random().toString(36).slice(2, 8)}`,
    email: 'info@rapidbox.co',
    clientCodePrefix: generatedPrefix,
    // databaseName is unique-indexed: each company in the same test needs its
    // own tenant db name (or an explicit shared one when branches are seeded).
    databaseName: dbName || `courier_test_public_tenant_${Math.random().toString(36).slice(2, 8)}`,
    isActive,
    isSuspended,
  });
}

async function makeLicense(companyId, { status = 'trial', endDate } = {}) {
  const License = masterConnection.model('License');
  return License.create({
    companyId,
    planId: new mongoose.Types.ObjectId(),
    startDate: new Date(),
    endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

beforeAll(async () => {
  masterConnection = await mongoose.createConnection(`${MONGO_URI}/${TEST_MASTER_DB}`).asPromise();
  tenantConnection = await mongoose.createConnection(`${MONGO_URI}/${TEST_TENANT_DB}`).asPromise();

  await masterConnection.dropDatabase();
  await tenantConnection.dropDatabase();

  masterConnection.model('Company', require('../../src/models/master/Company'));
  masterConnection.model('License', require('../../src/models/master/License'));
  require('../../src/models/tenant/Branch')(tenantConnection);

  await Promise.all([
    masterConnection.model('Company').init(),
    masterConnection.model('License').init(),
    tenantConnection.model('Branch').init(),
  ]);

  app = express();
  app.use(express.json());
  app.locals.masterConnection = masterConnection;
  app.use('/public', publicRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await Promise.all([
    masterConnection.model('Company').deleteMany({}),
    masterConnection.model('License').deleteMany({}),
    tenantConnection.model('Branch').deleteMany({}),
  ]);
});

afterAll(async () => {
  await connectionManager.closeAll().catch(() => {});
  await masterConnection.dropDatabase();
  await tenantConnection.dropDatabase();
  await masterConnection.close();
  await tenantConnection.close();
});

describe('GET /public/companies', () => {
  test('200: returns only active licensed companies with the minimal DTO', async () => {
    const included = await makeCompany({});
    await makeLicense(included._id);
    const noLicense = await makeCompany({});
    const inactive = await makeCompany({ isActive: false });
    await makeLicense(inactive._id);

    const res = await supertest(app).get('/public/companies');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const companies = res.body.data;
    expect(companies).toHaveLength(1);
    expect(companies[0].id).toBe(included._id.toString());
    expect(companies[0].slug).toBe(included.slug);
    expect(companies[0].name).toBe('Rapid Box');
    // DTO is exactly {id, slug, name} — no license, plan, databaseName or
    // internal company data may ever leak (spec: no license/plan leakage)
    expect(Object.keys(companies[0]).sort()).toEqual(['id', 'name', 'slug']);
    expect(String(noLicense._id)).not.toBe(companies[0].id);
    expect(String(inactive._id)).not.toBe(companies[0].id);
  });

  test('200: excludes companies whose license is expired or cancelled', async () => {
    const expired = await makeCompany({});
    await makeLicense(expired._id, { status: 'active', endDate: new Date(Date.now() - 1000) });
    const cancelled = await makeCompany({});
    await makeLicense(cancelled._id, { status: 'cancelled' });
    const valid = await makeCompany({});
    await makeLicense(valid._id, { status: 'trial' });

    const res = await supertest(app).get('/public/companies');

    expect(res.status).toBe(200);
    const companies = res.body.data;
    expect(companies).toHaveLength(1);
    expect(companies[0].id).toBe(valid._id.toString());
  });

  test('200: excludes suspended companies even with a valid license', async () => {
    const suspended = await makeCompany({ isSuspended: true });
    await makeLicense(suspended._id);

    const res = await supertest(app).get('/public/companies');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('200: excludes licensed companies without a clientCodePrefix (not registration-capable)', async () => {
    // A legacy company predating clientCodePrefix: active + licensed, but
    // auth.service.registerClient 404s on it — it must not be offered.
    const Company = masterConnection.model('Company');
    const legacy = await Company.create({
      name: 'Legacy Co',
      slug: `legacy-${Math.random().toString(36).slice(2, 8)}`,
      email: 'legacy@example.co',
      databaseName: `courier_test_public_tenant_${Math.random().toString(36).slice(2, 8)}`,
    });
    await makeLicense(legacy._id);
    const capable = await makeCompany({});
    await makeLicense(capable._id);

    const res = await supertest(app).get('/public/companies');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(capable._id.toString());
  });
});

describe('GET /public/companies/:companyId/branches', () => {
  test('200: returns only active branches with the minimal DTO', async () => {
    const company = await makeCompany({ dbName: TEST_TENANT_DB });
    await makeLicense(company._id);
    const activeBranch = await makeBranch({ isActive: true });
    await makeBranch({ isActive: false });

    const res = await supertest(app).get(`/public/companies/${company._id}/branches`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const branches = res.body.data;
    expect(branches).toHaveLength(1);
    expect(branches[0].id).toBe(activeBranch._id.toString());
    expect(branches[0].name).toBe('Main Branch');
    expect(branches[0].address).toBe('Av. Principal 123');
    // DTO is exactly {id, name, address} — no code/isMainBranch/internal data
    expect(Object.keys(branches[0]).sort()).toEqual(['address', 'id', 'name']);
  });

  test('404: unknown company id returns no branch data', async () => {
    const unknownId = new mongoose.Types.ObjectId();

    const res = await supertest(app).get(`/public/companies/${unknownId}/branches`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('404: malformed company id behaves like an unknown company', async () => {
    const res = await supertest(app).get('/public/companies/not-an-objectid/branches');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('404: inactive company returns no branch data', async () => {
    const company = await makeCompany({ isActive: false, dbName: TEST_TENANT_DB });
    await makeLicense(company._id);

    const res = await supertest(app).get(`/public/companies/${company._id}/branches`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('404: company without a valid license returns no branch data', async () => {
    const company = await makeCompany({ dbName: TEST_TENANT_DB });
    // No license created

    const res = await supertest(app).get(`/public/companies/${company._id}/branches`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
