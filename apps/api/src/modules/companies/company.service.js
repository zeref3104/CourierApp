const crypto = require('crypto');
const Plan = require('../../models/master/Plan');
const License = require('../../models/master/License');
const ConflictException = require('../../exceptions/ConflictException');
const NotFoundException = require('../../exceptions/NotFoundException');
const connectionManager = require('../../services/tenant/connectionManager');
const logger = require('../../logs/logger');

class CompanyService {
  getCompanyModel(masterConnection) {
    return masterConnection.model('Company');
  }

  getPlanModel(masterConnection) {
    return masterConnection.model('Plan');
  }

  getLicenseModel(masterConnection) {
    return masterConnection.model('License');
  }

  async create(data, masterConnection) {
    const Company = this.getCompanyModel(masterConnection);
    const Plan = this.getPlanModel(masterConnection);
    const License = this.getLicenseModel(masterConnection);

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

    // Provision tenant database — get connection creates it if not exists
    let tenantConnection;
    try {
      tenantConnection = await connectionManager.getConnection({
        id: company._id,
        slug: company.slug,
        dbName: company.databaseName,
      });
    } catch (err) {
      logger.error(`Failed to get tenant connection for ${company.slug}: ${err.message}`);
      await Company.findByIdAndDelete(company._id);
      throw err;
    }

    // Upsert Admin role
    const Role = tenantConnection.model('Role');
    let adminRole = await Role.findOne({ code: 'admin' });
    if (!adminRole) {
      adminRole = await Role.create({
        name: 'Admin',
        code: 'admin',
        description: 'System administrator',
        permissions: ['*.*'],
        isSystem: true,
      });
    }

    // Generate a random secure password
    const defaultPassword = crypto.randomBytes(6).toString('hex'); // 12 chars, e.g. "a1b2c3d4e5f6"

    // Create admin user
    const User = tenantConnection.model('User');
    await User.create({
      name: 'Administrador',
      email: data.adminEmail,
      password: defaultPassword,
      roleId: adminRole._id,
      mustChangePassword: true,
    });

    // Index email → tenant in master DB for automatic tenant resolution on login
    const TenantUserIndexModel = masterConnection.model('TenantUserIndex');
    await TenantUserIndexModel.create({
      email: data.adminEmail,
      companyId: company._id,
      tenantSlug: company.slug,
    });

    logger.info(`Tenant provisioned for ${company.slug}: role + admin user created`);

    return { ...company.toObject(), defaultPassword, adminEmail: data.adminEmail };
  }

  async findAll(query, masterConnection) {
    const Company = this.getCompanyModel(masterConnection);
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

  async findById(id, masterConnection) {
    const Company = this.getCompanyModel(masterConnection);
    const License = this.getLicenseModel(masterConnection);
    const company = await Company.findById(id).populate('planId');
    if (!company) throw new NotFoundException('Company');
    const license = await License.findOne({ companyId: company._id }).sort({ createdAt: -1 });
    return { company, license };
  }

  async update(id, data, masterConnection) {
    const Company = this.getCompanyModel(masterConnection);
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

  async delete(id, masterConnection) {
    const Company = this.getCompanyModel(masterConnection);
    const License = this.getLicenseModel(masterConnection);
    const company = await Company.findById(id);
    if (!company) throw new NotFoundException('Company');

    const dbName = company.databaseName;

    // Drop the tenant database
    try {
      await connectionManager.dropDatabase(dbName);
    } catch (err) {
      logger.error(`Failed to drop database ${dbName}: ${err.message}`);
      // Continue — delete company record even if DB drop fails
    }

    // Delete licenses
    await License.deleteMany({ companyId: company._id });

    // Delete the company record
    await Company.findByIdAndDelete(id);

    logger.info(`Company deleted: ${company.slug} (DB: ${dbName})`);
    return { deleted: true, slug: company.slug, databaseName: dbName };
  }
}

module.exports = new CompanyService();