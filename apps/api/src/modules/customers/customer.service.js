const BaseRepository = require('../../repositories/base/base.repository');
const ConflictException = require('../../exceptions/ConflictException');
const NotFoundException = require('../../exceptions/NotFoundException');
const { eventBus, EVENTS } = require('../../events');
const { nextSequence } = require('../../services/tenant/counter.service');
const masterNextSequence = require('../../services/master/counter.service').nextSequence;
const { generateCustomerCode, generateClientCode } = require('@courier/helpers');

const PACKAGE_REPO_MODEL = 'Package';
const PAYMENT_REPO_MODEL = 'Payment';

class CustomerService {
  /**
   * @param {Object} models - req.tenantModels (all Mongoose models for this tenant)
   * @param {Object} [options] - Master context for global client codes (design D7)
   * @param {import('mongoose').Connection} [options.masterConnection] - Master DB connection
   * @param {import('mongoose').Types.ObjectId} [options.companyId] - Current company id
   * @param {string} [options.clientCodePrefix] - Current company prefix (set at provisioning)
   */
  constructor(models, options = {}) {
    this.models = models;
    this.repository = new BaseRepository(models.Customer);
    this.packageRepo = new BaseRepository(models[PACKAGE_REPO_MODEL]);
    this.paymentRepo = new BaseRepository(models[PAYMENT_REPO_MODEL]);
    this.masterConnection = options.masterConnection;
    this.companyId = options.companyId;
    this.clientCodePrefix = options.clientCodePrefix;
  }

  async create(data, branchId) {
    const code = await this._generateCode();

    if (data.email) {
      const existing = await this.models.Customer.findOne({ email: data.email });
      if (existing) throw new ConflictException('Email already in use');
    }

    // Assign the user's branch when the caller doesn't provide one, so every
    // customer gets a branch (branch-scoped queries depend on it).
    if (!data.branchId && branchId) data.branchId = branchId;
    // Last resort: fall back to the main branch so no customer is left orphaned.
    if (!data.branchId) {
      const mainBranch = await this.models.Branch.findOne({ isMainBranch: true }).select('_id').lean();
      if (mainBranch) data.branchId = mainBranch._id;
    }

    const customer = await this.repository.create({ ...data, code });
    eventBus.emit(EVENTS.CUSTOMER_CREATED, { customer });

    return customer;
  }

  async findAll(query = {}) {
    const { search, page = 1, limit = 20, branchId, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { document: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }
    if (branchId) filter.branchId = branchId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    return this.repository.findAll(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: { path: 'branchId', select: 'name code' },
    });
  }

  async findById(id) {
    const customer = await this.repository.findById(id, {
      populate: { path: 'branchId', select: 'name code' },
    });

    if (!customer) throw new NotFoundException('Customer');

    // Compute the summary with counts + $sum aggregations instead of loading
    // every package/payment document into memory (N+1 / unbounded read).
    const [totalPackages, pendingPackages, deliveredPackages, paidTotals, pendingTotals] = await Promise.all([
      this.models.Package.countDocuments({ customerId: id }),
      this.models.Package.countDocuments({ customerId: id, status: { $nin: ['entregado', 'cancelado', 'extraviado'] } }),
      this.models.Package.countDocuments({ customerId: id, status: 'entregado' }),
      this.models.Payment.aggregate([
        { $match: { customerId: id, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.models.Payment.aggregate([
        { $match: { customerId: id, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const summary = {
      totalPackages,
      pendingPackages,
      deliveredPackages,
      totalPaid: paidTotals.length > 0 ? paidTotals[0].total : 0,
      pendingBalance: pendingTotals.length > 0 ? pendingTotals[0].total : 0,
    };

    return { ...customer.toObject(), ...summary };
  }

  async update(id, data, branchId) {
    const customer = await this.repository.findById(id);
    if (!customer) throw new NotFoundException('Customer');

    // The customer code is immutable once assigned (global identity, spec D7).
    if (data.code) delete data.code;

    if (data.email && data.email !== customer.email) {
      const existing = await this.models.Customer.findOne({ email: data.email });
      if (existing) throw new ConflictException('Email already in use');
    }

    // A fixed-branch user never moves a customer out of their branch.
    if (branchId && data.branchId && data.branchId !== branchId) {
      data.branchId = branchId;
    }

    return this.repository.updateById(id, data);
  }

  async deactivate(id) {
    const customer = await this.repository.findById(id);
    if (!customer) throw new NotFoundException('Customer');

    const activePackages = await this.models.Package.countDocuments({
      customerId: id,
      status: { $nin: ['entregado', 'cancelado', 'extraviado'] },
    });

    if (activePackages > 0) {
      throw new ConflictException('Cannot deactivate customer with active packages');
    }

    return this.repository.softDelete(id);
  }

  async getPackages(customerId, query = {}) {
    const { page = 1, limit = 20, status, dateFrom, dateTo } = query;
    const filter = { customerId };

    if (status) filter.status = status;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    return this.packageRepo.findAll(filter, {
      page: Number(page),
      limit: Number(limit),
      populate: { path: 'branchId', select: 'name' },
      sort: { createdAt: -1 },
    });
  }

  async getPayments(customerId, query = {}) {
    const { page = 1, limit = 20, dateFrom, dateTo } = query;
    const filter = { customerId };

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    return this.paymentRepo.findAll(filter, {
      page: Number(page),
      limit: Number(limit),
      populate: { path: 'packages', select: 'tracking' },
      sort: { createdAt: -1 },
    });
  }

  async _generateCode() {
    // Global client codes (client-code-identity spec): sequence comes from the
    // master CompanyCounter, so codes are distinct across all tenants.
    if (this.masterConnection && this.companyId && this.clientCodePrefix) {
      const seq = await masterNextSequence(this.masterConnection, this.companyId);
      return generateClientCode(this.clientCodePrefix, seq);
    }

    // Legacy fallback (tenant counter + CUS- format) for companies without a
    // prefix yet and for rollback contexts.
    const seq = await nextSequence(this.models, 'customer-code', {
      seedFrom: async () => {
        const last = await this.models.Customer.findOne({}).sort({ createdAt: -1 }).select('code');
        return last ? parseInt(last.code.split('-')[1], 10) : 0;
      },
    });
    return generateCustomerCode(seq);
  }
}

module.exports = CustomerService;