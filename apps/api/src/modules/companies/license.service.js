const License = require('../../models/master/License');
const Company = require('../../models/master/Company');
const NotFoundException = require('../../exceptions/NotFoundException');
const ConflictException = require('../../exceptions/ConflictException');
const ValidationException = require('../../exceptions/ValidationException');
const logger = require('../../logs/logger');

/**
 * Derive license status from dates.
 * If no explicit status is provided, calculate based on current date.
 */
function deriveStatus(startDate, endDate, explicitStatus) {
  if (explicitStatus) return explicitStatus;
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) return 'trial'; // not yet active
  if (now > end) return 'expired';
  return 'active';
}

class LicenseService {
  async create(data, masterConnection) {
    const LicenseModel = masterConnection.model('License');
    const CompanyModel = masterConnection.model('Company');

    // Validate company exists
    const company = await CompanyModel.findById(data.companyId);
    if (!company) throw new NotFoundException('Company');

    // One non-cancelled license per company
    const existing = await LicenseModel.findOne({
      companyId: data.companyId,
      status: { $nin: ['cancelled'] },
    });
    if (existing) {
      throw new ConflictException('Company already has an active license. Update or cancel it first.');
    }

    const status = deriveStatus(data.startDate, data.endDate, data.status);

    const license = await LicenseModel.create({
      companyId: data.companyId,
      planId: data.planId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status,
    });

    logger.info(`License created for company ${company.slug}: ${status} until ${data.endDate}`);
    return license.populate('companyId planId');
  }

  async findAll(query, masterConnection) {
    const LicenseModel = masterConnection.model('License');
    const { companyId, status, page = 1, limit = 50 } = query;

    const filter = {};
    if (companyId) filter.companyId = companyId;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      LicenseModel.find(filter)
        .populate('companyId planId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      LicenseModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id, masterConnection) {
    const LicenseModel = masterConnection.model('License');
    const license = await LicenseModel.findById(id).populate('companyId planId');
    if (!license) throw new NotFoundException('License');
    return license;
  }

  async update(id, data, masterConnection) {
    const LicenseModel = masterConnection.model('License');
    const license = await LicenseModel.findById(id);
    if (!license) throw new NotFoundException('License');

    const updates = {};
    if (data.planId !== undefined) updates.planId = data.planId;
    if (data.startDate !== undefined) updates.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updates.endDate = new Date(data.endDate);

    // Auto-recalculate status from dates when dates change
    const newStart = updates.startDate || license.startDate;
    const newEnd = updates.endDate || license.endDate;
    updates.status = deriveStatus(newStart, newEnd, data.status);

    Object.assign(license, updates);
    await license.save();

    logger.info(`License ${id} updated: status=${updates.status}`);
    return license.populate('companyId planId');
  }

  async delete(id, masterConnection) {
    const LicenseModel = masterConnection.model('License');
    const license = await LicenseModel.findById(id);
    if (!license) throw new NotFoundException('License');

    await LicenseModel.findByIdAndDelete(id);
    logger.info(`License ${id} deleted`);
    return { deleted: true };
  }

  /**
   * Create or update license during company provisioning.
   * Called by company.service.create() — accepts optional dates from admin.
   */
  async provision(companyId, planId, masterConnection, { startDate, endDate } = {}) {
    const LicenseModel = masterConnection.model('License');
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const status = deriveStatus(start, end);

    const license = await LicenseModel.create({
      companyId,
      planId,
      startDate: start,
      endDate: end,
      status,
    });

    logger.info(`License provisioned for company ${companyId}: ${status} (${start.toISOString()} → ${end.toISOString()})`);
    return license;
  }
}

module.exports = new LicenseService();
