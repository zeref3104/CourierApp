const Company = require('../../models/master/Company');
const Plan = require('../../models/master/Plan');
const License = require('../../models/master/License');
const ConflictException = require('../../exceptions/ConflictException');
const NotFoundException = require('../../exceptions/NotFoundException');
const logger = require('../../logs/logger');

class CompanyService {
  async create(data) {
    const existing = await Company.findOne({ slug: data.slug });
    if (existing) throw new ConflictException('Company slug already exists');

    const databaseName = `courier_${data.slug}`;

    const company = await Company.create({
      ...data,
      databaseName,
      settings: {
        defaultCurrency: 'DOP',
        locale: 'es-DO',
        timezone: 'America/Santo_Domingo',
      },
    });

    // Create trial license
    await License.create({
      companyId: company._id,
      planId: data.planId,
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'trial',
    });

    logger.info(`Company created: ${company.slug} (DB: ${databaseName})`);
    return company;
  }

  async findAll(query) {
    const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [data, total] = await Promise.all([
      Company.find(filter).sort(sort).skip(skip).limit(Number(limit)).populate('planId'),
      Company.countDocuments(filter),
    ]);

    return {
      data,
      meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id) {
    const company = await Company.findById(id).populate('planId');
    if (!company) throw new NotFoundException('Company');
    const license = await License.findOne({ companyId: company._id }).sort({ createdAt: -1 });
    return { company, license };
  }

  async update(id, data) {
    const company = await Company.findById(id);
    if (!company) throw new NotFoundException('Company');

    if (data.slug && data.slug !== company.slug) {
      const existing = await Company.findOne({ slug: data.slug });
      if (existing) throw new ConflictException('Slug already in use');
    }

    Object.assign(company, data);
    await company.save();
    return company;
  }

  async deactivate(id) {
    const company = await Company.findById(id);
    if (!company) throw new NotFoundException('Company');

    company.isActive = false;
    await company.save();

    await License.updateMany(
      { companyId: company._id, status: { $in: ['active', 'trial'] } },
      { status: 'cancelled', endDate: new Date() }
    );

    return company;
  }
}

module.exports = new CompanyService();