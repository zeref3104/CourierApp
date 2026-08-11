/**
 * Unit tests for the public registration lookup service (client-registration
 * spec):
 * - listCompanies: ONLY active, non-suspended companies WITH an active/trial
 *   license AND a non-empty clientCodePrefix (registration-capable only);
 *   DTO is exactly { id, slug, name } — no license/plan leakage.
 * - listBranches: only active branches of an active + licensed company;
 *   DTO is exactly { id, name, address }; unknown/inactive/unlicensed company
 *   or malformed id -> NotFoundException (404).
 */
const mongoose = require('mongoose');
const publicService = require('../../src/modules/public/public.service');
const NotFoundException = require('../../src/exceptions/NotFoundException');

jest.mock('../../src/services/tenant/connectionManager', () => ({
  getConnection: jest.fn(),
}));
const connectionManager = require('../../src/services/tenant/connectionManager');

function companyDoc({ _id, slug, name, isActive = true, isSuspended = false, planId = null, license, clientCodePrefix } = {}) {
  return { _id, slug, name, isActive, isSuspended, planId, license, clientCodePrefix };
}

function licenseDoc({ companyId, status = 'active', endDate = new Date(Date.now() + 86400000) } = {}) {
  return { companyId, status, endDate };
}

function branchDoc({ _id, name, address, isActive = true } = {}) {
  return { _id, name, address, isActive };
}

function mockMaster({ companies = [], licenses = [], company = null, license = null }) {
  const query = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
  const Company = {
    find: jest.fn().mockReturnValue(query(companies)),
    findOne: jest.fn().mockReturnValue(query(company)),
  };
  const License = {
    find: jest.fn().mockReturnValue(query(licenses)),
    findOne: jest.fn().mockReturnValue(query(license)),
  };
  const masterConnection = {
    model: jest.fn((name) => ({ Company, License }[name])),
  };
  return { masterConnection, Company, License };
}

describe('publicService.listCompanies', () => {
  test('returns ONLY active, prefix-capable companies with an active license as {id,slug,name}', async () => {
    const active = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'active-co', name: 'Active Co', clientCodePrefix: 'ACT' });
    const noPrefix = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'legacy-co', name: 'Legacy Co' });
    const inactive = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'inactive-co', name: 'Inactive Co', isActive: false });
    const suspended = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'susp-co', name: 'Susp Co', isSuspended: true });

    const { masterConnection, Company, License } = mockMaster({
      companies: [active, noPrefix, inactive, suspended],
      licenses: [
        licenseDoc({ companyId: active._id }),
        licenseDoc({ companyId: noPrefix._id }),
      ],
    });

    const result = await publicService.listCompanies(masterConnection);

    expect(Company.find).toHaveBeenCalledWith({ isActive: true, isSuspended: { $ne: true } });
    expect(License.find).toHaveBeenCalledWith(expect.objectContaining({
      companyId: { $in: [active._id, noPrefix._id, inactive._id, suspended._id] },
    }));
    // Active + licensed but WITHOUT clientCodePrefix is excluded too:
    // auth.service.registerClient 404s 'Company is not accepting registrations'
    // for such companies, so they must not appear as registration options.
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: String(active._id), slug: 'active-co', name: 'Active Co' });
  });

  test('excludes companies whose license is not active/trial or is expired', async () => {
    const expiring = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'exp', name: 'Expiring', clientCodePrefix: 'EXP' });
    const expired = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'expired', name: 'Expired' });
    const cancelled = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'canc', name: 'Cancelled' });
    const none = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'none', name: 'No License' });

    // Emulate the DB: License.find returns only licenses matching the service's
    // filter (status active/trial AND endDate in the future). The service's own
    // job is to drop companies that have no such license.
    const future = new Date(Date.now() + 86400000);
    const { masterConnection, License } = mockMaster({
      companies: [expiring, expired, cancelled, none],
      licenses: [
        licenseDoc({ companyId: expiring._id, status: 'trial', endDate: future }),
        // expired / cancelled / missing licenses are NOT returned by the query
      ],
    });

    const result = await publicService.listCompanies(masterConnection);

    expect(License.find).toHaveBeenCalledWith({
      companyId: { $in: expect.any(Array) },
      status: { $in: ['active', 'trial'] },
      endDate: { $gte: expect.any(Date) },
    });
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('exp');
  });

  test('DTO never leaks license, plan, email or other internal fields', async () => {
    const secretive = companyDoc({
      _id: new mongoose.Types.ObjectId(),
      slug: 'secret',
      name: 'Secret Co',
      planId: new mongoose.Types.ObjectId(),
      license: { planId: new mongoose.Types.ObjectId(), status: 'trial', pricing: { monthly: 99 } },
      email: 'ops@secret.co',
      databaseName: 'courier_secret',
      clientCodePrefix: 'SEC',
      settings: { defaultCurrency: 'USD' },
    });

    const { masterConnection } = mockMaster({
      companies: [secretive],
      licenses: [licenseDoc({ companyId: secretive._id })],
    });

    const [dto] = await publicService.listCompanies(masterConnection);

    expect(Object.keys(dto).sort()).toEqual(['id', 'name', 'slug']);
    expect(JSON.stringify(dto)).not.toContain('plan');
    expect(JSON.stringify(dto)).not.toContain('license');
    expect(JSON.stringify(dto)).not.toContain('databaseName');
    expect(JSON.stringify(dto)).not.toContain('clientCodePrefix');
  });

  test('returns an empty array when no company qualifies', async () => {
    const { masterConnection } = mockMaster({ companies: [], licenses: [] });
    const result = await publicService.listCompanies(masterConnection);
    expect(result).toEqual([]);
  });

  test('excludes licensed companies without a clientCodePrefix (not registration-capable)', async () => {
    const capable = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'cap', name: 'Cap Co', clientCodePrefix: 'CAP' });
    // Legacy company predating the clientCodePrefix field: active + licensed
    // but auth.service.registerClient would 404 on it ('Company is not
    // accepting registrations'), so it must never be offered for registration.
    const legacy = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'legacy', name: 'Legacy Co' });

    const { masterConnection } = mockMaster({
      companies: [capable, legacy],
      licenses: [
        licenseDoc({ companyId: capable._id }),
        licenseDoc({ companyId: legacy._id }),
      ],
    });

    const result = await publicService.listCompanies(masterConnection);

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('cap');
  });

  test('excludes licensed companies with a blank clientCodePrefix', async () => {
    const blank = companyDoc({ _id: new mongoose.Types.ObjectId(), slug: 'blank', name: 'Blank Co', clientCodePrefix: '   ' });
    const { masterConnection } = mockMaster({
      companies: [blank],
      licenses: [licenseDoc({ companyId: blank._id })],
    });

    const result = await publicService.listCompanies(masterConnection);
    expect(result).toEqual([]);
  });
});

describe('publicService.listBranches', () => {
  const COMPANY_ID = new mongoose.Types.ObjectId();
  const activeBranch = branchDoc({ _id: new mongoose.Types.ObjectId(), name: 'Main', address: 'Av. Principal 12' });
  const inactiveBranch = branchDoc({ _id: new mongoose.Types.ObjectId(), name: 'Old', address: 'Calle Vieja 5', isActive: false });

  function mockCompanyTenant({ company, license, branches }) {
    const query = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
    // Emulate the DB: Branch.find({isActive:true}) only returns active branches.
    const Branch = {
      find: jest.fn((filter) => query(filter.isActive ? branches.filter((b) => b.isActive) : branches)),
    };
    const tenantConnection = { model: jest.fn(() => Branch) };
    connectionManager.getConnection.mockResolvedValue(tenantConnection);
    return mockMaster({ company, license });
  }

  test('returns only active branches of an active + licensed company as {id,name,address}', async () => {
    const company = companyDoc({ _id: COMPANY_ID, slug: 'act', name: 'Active' });
    const { masterConnection, Company } = mockCompanyTenant({
      company,
      license: licenseDoc({ companyId: COMPANY_ID }),
      branches: [activeBranch, inactiveBranch],
    });

    const result = await publicService.listBranches(masterConnection, String(COMPANY_ID));

    expect(Company.findOne).toHaveBeenCalledWith({ _id: String(COMPANY_ID), isActive: true, isSuspended: { $ne: true } });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: String(activeBranch._id), name: 'Main', address: 'Av. Principal 12' });
    expect(connectionManager.getConnection).toHaveBeenCalledTimes(1);
  });

  test('throws 404 for an unknown company id', async () => {
    const { masterConnection } = mockCompanyTenant({ company: null, license: null, branches: [] });
    await expect(publicService.listBranches(masterConnection, String(COMPANY_ID)))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  test('throws 404 for an inactive company', async () => {
    const company = companyDoc({ _id: COMPANY_ID, slug: 'off', name: 'Off', isActive: false });
    // findOne already filters isActive:true — returns nothing
    const { masterConnection } = mockCompanyTenant({ company: null, license: null, branches: [] });
    await expect(publicService.listBranches(masterConnection, String(company._id)))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  test('throws 404 for a company without an active license', async () => {
    const company = companyDoc({ _id: COMPANY_ID, slug: 'nolic', name: 'No Lic' });
    const { masterConnection } = mockCompanyTenant({ company, license: null, branches: [] });
    await expect(publicService.listBranches(masterConnection, String(COMPANY_ID)))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  test('throws 404 for a malformed company id (no CastError leak)', async () => {
    const { masterConnection } = mockCompanyTenant({ company: null, license: null, branches: [] });
    await expect(publicService.listBranches(masterConnection, 'not-an-objectid'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
