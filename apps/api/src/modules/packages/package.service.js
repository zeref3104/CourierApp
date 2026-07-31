const BaseRepository = require('../../repositories/base/base.repository');
const NotFoundException = require('../../exceptions/NotFoundException');
const ValidationException = require('../../exceptions/ValidationException');
const { eventBus, EVENTS } = require('../../events');
const { STATUS_TRANSITIONS } = require('../../models/tenant/index');
const { calculatePricing, generateTrackingNumber } = require('@courier/helpers');
const PlanEnforcer = require('../../services/planEnforcer');
const { nextSequence } = require('../../services/tenant/counter.service');

// Shared settings cache across all instances (per process).
// Keyed by dbName + setting key so tenants never read each other's settings.
const settingsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class PackageService {
  constructor(models, plan, tenantSlug) {
    this.models = models;
    this.plan = plan;
    this.tenantSlug = tenantSlug;
    this.dbName = models.Setting.db.name;
    this.repository = new BaseRepository(models.Package);
    this.historyRepo = new BaseRepository(models.PackageHistory);
  }

  async create(data, userId, branchId) {
    // Enforce plan limit
    const enforcer = new PlanEnforcer(this.plan, this.models);
    await enforcer.checkMaxPackagesPerMonth();
    const customer = await this.models.Customer.findById(data.customerId);
    if (!customer) throw new NotFoundException('Customer');

    // Assign the user's branch when the caller doesn't provide one, so every
    // package gets a branch (branch-scoped queries and labels depend on it).
    if (!data.branchId && branchId) data.branchId = branchId;

    const pricePerLb = await this._getSetting('price_per_lb', 0);
    const minimumPrice = await this._getSetting('minimum_price', 0);
    const taxRate = await this._getSetting('tax_rate', 18);

    const { baseCost, tax, total } = calculatePricing(data.weight, pricePerLb, minimumPrice, taxRate);

    const tracking = await this._generateTracking();

    const pkg = await this.repository.create({
      ...data,
      tracking,
      cost: baseCost,
      shippingCost: baseCost,
      tax,
      total,
      status: 'recibido_miami',
      createdById: userId,
      receivedAt: new Date(),
    });

    await this._recordHistory(pkg._id, null, 'recibido_miami', userId, 'Package created', pkg.branchId);

    // Emit PACKAGE_CREATED only — the initial status is part of creation, so a
    // separate PACKAGE_STATUS_CHANGED here would duplicate notifications/emails.
    eventBus.emit(EVENTS.PACKAGE_CREATED, { package: pkg, userId, tenantSlug: this.tenantSlug });

    return pkg;
  }

  async findAll(query = {}) {
    const {
      page = 1, limit = 20, search, status, branchId,
      customerId, isPaid, dateFrom, dateTo,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = query;

    const filter = {};

    if (search) {
      // Search customers by name, lastName, or code to include their packages
      const matchingCustomers = await this.models.Customer.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
        ],
      }).select('_id').lean();

      const customerIds = matchingCustomers.map((c) => c._id);

      filter.$or = [
        { tracking: { $regex: search, $options: 'i' } },
        { carrierTracking: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];

      if (customerIds.length > 0) {
        filter.$or.push({ customerId: { $in: customerIds } });
      }
    }
    if (status) filter.status = Array.isArray(status) ? { $in: status } : status;
    if (branchId) filter.branchId = branchId;
    if (customerId) filter.customerId = customerId;
    if (isPaid !== undefined) filter.isPaid = isPaid === 'true';
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    return this.repository.findAll(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: [
        { path: 'customerId', select: 'name lastName code phone' },
        { path: 'branchId', select: 'name' },
      ],
    });
  }

  async findByTracking(tracking) {
    const pkg = await this.models.Package.findOne({ tracking })
      .populate('customerId', 'name lastName code phone email')
      .populate('branchId', 'name');

    if (!pkg) throw new NotFoundException(`Package with tracking ${tracking}`);
    return pkg;
  }

  async findById(id) {
    const pkg = await this.repository.findById(id, {
      populate: [
        { path: 'customerId', select: 'name lastName code phone' },
        { path: 'branchId', select: 'name' },
      ],
    });
    if (!pkg) throw new NotFoundException('Package');
    return pkg;
  }

  async update(id, data) {
    const pkg = await this.repository.findById(id);
    if (!pkg) throw new NotFoundException('Package');

    if (data.weight && data.weight !== pkg.weight) {
      const pricePerLb = await this._getSetting('price_per_lb', 0);
      const minimumPrice = await this._getSetting('minimum_price', 0);
      const taxRate = await this._getSetting('tax_rate', 18);

      const { baseCost, tax, total } = calculatePricing(data.weight, pricePerLb, minimumPrice, taxRate);
      data.cost = baseCost;
      data.shippingCost = baseCost;
      data.tax = tax;
      data.total = total;
    }

    return this.repository.updateById(id, data);
  }

  async changeStatus(id, newStatus, userId, notes = '') {
    const pkg = await this.repository.findById(id);
    if (!pkg) throw new NotFoundException('Package');

    const allowed = STATUS_TRANSITIONS[pkg.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ValidationException([{
        field: 'status',
        message: `Cannot transition from '${pkg.status}' to '${newStatus}'`,
      }]);
    }

    const updateData = { status: newStatus };
    if (newStatus === 'entregado') {
      updateData.deliveredAt = new Date();
      updateData.deliveredById = userId;
    }

    const updated = await this.repository.updateById(id, updateData);
    await this._recordHistory(id, pkg.status, newStatus, userId, notes, pkg.branchId);

    eventBus.emit(EVENTS.PACKAGE_STATUS_CHANGED, {
      package: updated,
      fromStatus: pkg.status,
      toStatus: newStatus,
      userId,
      notes,
      tenantSlug: this.tenantSlug,
    });

    return updated;
  }

  async getHistory(packageId) {
    const history = await this.models.PackageHistory.find({ packageId })
      .sort({ createdAt: -1 })
      .populate('changedBy', 'name')
      .populate('branchId', 'name');

    return history;
  }

  async uploadPhotos(packageId, files) {
    const pkg = await this.repository.findById(packageId);
    if (!pkg) throw new NotFoundException('Package');

    const urls = files.map((f) => f.path);
    pkg.photos.push(...urls);
    await pkg.save();

    return pkg.photos;
  }

  async _recordHistory(packageId, fromStatus, toStatus, userId, notes, branchId) {
    return this.historyRepo.create({
      packageId,
      fromStatus,
      toStatus,
      changedBy: userId,
      notes,
      branchId,
    });
  }

  async _generateTracking() {
    const prefix = process.env.TENANT_PREFIX || 'CPR';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const seq = await nextSequence(this.models, `tracking-${prefix}-${date}`, {
      seedFrom: async () => {
        const doc = await this.models.Package.findOne({
          tracking: new RegExp(`^${prefix}-${date}-`),
        }).sort({ tracking: -1 }).select('tracking');
        return doc ? parseInt(doc.tracking.split('-').pop(), 10) : 0;
      },
    });

    return generateTrackingNumber({ seq, date, prefix });
  }

  async _getSetting(key, defaultValue) {
    const cacheKey = `${this.dbName}:${key}`;
    const cached = settingsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.value;
    }

    const setting = await this.models.Setting.findOne({ key });
    const value = setting ? setting.value : defaultValue;

    settingsCache.set(cacheKey, { value, timestamp: Date.now() });
    return value;
  }

  /**
   * Invalidate a specific setting, all settings for a tenant, or everything.
   * Call this after a setting is updated via the settings module.
   */
  static invalidateCache(dbName, key) {
    const prefix = dbName ? `${dbName}:` : '';
    if (key) {
      settingsCache.delete(prefix + key);
    } else if (dbName) {
      for (const k of settingsCache.keys()) {
        if (k.startsWith(prefix)) settingsCache.delete(k);
      }
    } else {
      settingsCache.clear();
    }
  }
}

module.exports = PackageService;