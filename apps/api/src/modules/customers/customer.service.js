const BaseRepository = require('../../repositories/base/base.repository');
const ConflictException = require('../../exceptions/ConflictException');
const NotFoundException = require('../../exceptions/NotFoundException');
const { eventBus, EVENTS } = require('../../events');
const { nextSequence } = require('../../services/tenant/counter.service');

const PACKAGE_REPO_MODEL = 'Package';
const PAYMENT_REPO_MODEL = 'Payment';

class CustomerService {
  /**
   * @param {Object} models - req.tenantModels (all Mongoose models for this tenant)
   */
  constructor(models) {
    this.models = models;
    this.repository = new BaseRepository(models.Customer);
    this.packageRepo = new BaseRepository(models[PACKAGE_REPO_MODEL]);
    this.paymentRepo = new BaseRepository(models[PAYMENT_REPO_MODEL]);
  }

  async create(data) {
    const code = await this._generateCode();

    if (data.email) {
      const existing = await this.models.Customer.findOne({ email: data.email });
      if (existing) throw new ConflictException('Email already in use');
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

  async update(id, data) {
    const customer = await this.repository.findById(id);
    if (!customer) throw new NotFoundException('Customer');

    if (data.email && data.email !== customer.email) {
      const existing = await this.models.Customer.findOne({ email: data.email });
      if (existing) throw new ConflictException('Email already in use');
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
    const seq = await nextSequence(this.models, 'customer-code', {
      seedFrom: async () => {
        const last = await this.models.Customer.findOne({}).sort({ createdAt: -1 }).select('code');
        return last ? parseInt(last.code.split('-')[1], 10) : 0;
      },
    });
    return `CUS-${String(seq).padStart(4, '0')}`;
  }
}

module.exports = CustomerService;