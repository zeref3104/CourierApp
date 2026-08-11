const mongoose = require('mongoose');
const connectionManager = require('../../services/tenant/connectionManager');
const NotFoundException = require('../../exceptions/NotFoundException');

/**
 * Public registration lookup (client-registration spec).
 *
 * Both endpoints are pre-auth and pre-tenant (whitelisted in tenantResolver):
 * - GET /public/companies         -> active companies with an active license
 *   AND a clientCodePrefix (registration-capable only; auth.service.registerClient
 *   404s 'Company is not accepting registrations' when the prefix is missing)
 * - GET /public/companies/:id/branches -> active branches of an active company
 *
 * DTOs are deliberately minimal so no license, plan, pricing, databaseName or
 * other internal company data can ever leak to unauthenticated callers.
 */

function toCompanyPublicDto(company) {
  return {
    id: String(company._id),
    slug: company.slug,
    name: company.name,
  };
}

function toBranchPublicDto(branch) {
  return {
    id: String(branch._id),
    name: branch.name,
    address: branch.address,
  };
}

class PublicService {
  /**
   * Active companies with an active/trial, non-expired license, as
   * [{ id, slug, name }]. Inactive/suspended companies, companies whose
   * license is missing, cancelled, expired or ended, and companies WITHOUT a
   * clientCodePrefix (not registration-capable — auth.service.registerClient
   * 404s on them) are excluded.
   */
  async listCompanies(masterConnection) {
    const Company = masterConnection.model('Company');
    const License = masterConnection.model('License');

    const companies = await Company.find({
      isActive: true,
      isSuspended: { $ne: true },
    }).lean();

    if (companies.length === 0) return [];

    const companyIds = companies.map((c) => c._id);
    const licenses = await License.find({
      companyId: { $in: companyIds },
      status: { $in: ['active', 'trial'] },
      endDate: { $gte: new Date() },
    }).lean();

    const licensedIds = new Set(licenses.map((l) => String(l.companyId)));
    return companies
      .filter((c) => licensedIds.has(String(c._id)))
      .filter((c) => c.clientCodePrefix && String(c.clientCodePrefix).trim().length > 0)
      .map(toCompanyPublicDto);
  }

  /**
   * Active branches of an active + licensed company, as [{ id, name, address }].
   * Unknown, inactive, suspended or unlicensed companies -> 404 with no data.
   */
  async listBranches(masterConnection, companyId) {
    // Malformed ids must behave like unknown companies (404), not CastError.
    if (!mongoose.isValidObjectId(companyId)) {
      throw new NotFoundException('Company');
    }

    const Company = masterConnection.model('Company');
    const License = masterConnection.model('License');

    const company = await Company.findOne({
      _id: companyId,
      isActive: true,
      isSuspended: { $ne: true },
    }).lean();

    if (!company) throw new NotFoundException('Company');

    const license = await License.findOne({
      companyId: company._id,
      status: { $in: ['active', 'trial'] },
      endDate: { $gte: new Date() },
    }).lean();

    if (!license) throw new NotFoundException('Company');

    const tenantConnection = await connectionManager.getConnection({
      id: company._id,
      slug: company.slug,
      dbName: company.databaseName,
      clientCodePrefix: company.clientCodePrefix,
    });

    const Branch = tenantConnection.model('Branch');
    const branches = await Branch.find({ isActive: true }).lean();

    return branches.map(toBranchPublicDto);
  }
}

module.exports = new PublicService();
