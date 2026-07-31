const BaseRepository = require('../../repositories/base/base.repository');
const NotFoundException = require('../../exceptions/NotFoundException');
const ValidationException = require('../../exceptions/ValidationException');
const { eventBus, EVENTS } = require('../../events');
const { STATUS_TRANSITIONS } = require('../../models/tenant/index');

class DeliveryService {
  constructor(models, tenantSlug) {
    this.models = models;
    this.tenantSlug = tenantSlug;
    this.repository = new BaseRepository(models.Delivery);
  }

  async create(data, userId, userBranchId) {
    const pkg = await this.models.Package.findById(data.packageId);
    if (!pkg) throw new NotFoundException('Package');

    if (!['disponible', 'en_reparto'].includes(pkg.status)) {
      throw new NotFoundException('Package is not available for delivery');
    }

    const delivery = await this.repository.create({
      ...data,
      // Delivery is branch-scoped like Package: prefer an explicit branchId,
      // then the creator's branch, then the package's branch as last resort.
      branchId: data.branchId || userBranchId || pkg.branchId,
      deliveredById: userId,
      deliveredAt: new Date(),
    });

    // Update package status
    const prevStatus = pkg.status;
    if (data.type === 'branch') {
      pkg.status = 'entregado';
      pkg.deliveredAt = new Date();
      pkg.deliveredById = userId;
    } else {
      pkg.status = 'en_reparto';
    }
    await pkg.save();

    // Creating a delivery moves the package into a new status — emit the
    // accurate status_changed event. DELIVERY_COMPLETED is emitted only when
    // completeDelivery() actually finalizes the delivery.
    eventBus.emit(EVENTS.PACKAGE_STATUS_CHANGED, {
      package: pkg,
      fromStatus: prevStatus,
      toStatus: pkg.status,
      userId,
      tenantSlug: this.tenantSlug,
    });

    return delivery.populate(['packageId', 'deliveredById']);
  }

  async findAll(query = {}) {
    const {
      page = 1, limit = 20, type, search, dateFrom, dateTo,
      branchId, deliveredById, sortBy = 'deliveredAt', sortOrder = 'desc',
    } = query;

    const filter = {};
    if (type) filter.type = type;
    if (branchId) filter.branchId = branchId;
    if (deliveredById) filter.deliveredById = deliveredById;

    if (search) {
      // Search by receiver info or by the related package's tracking number.
      const matchingPackages = await this.models.Package.find({
        $or: [
          { tracking: { $regex: search, $options: 'i' } },
          { carrierTracking: { $regex: search, $options: 'i' } },
        ],
      }).select('_id').lean();
      const packageIds = matchingPackages.map((p) => p._id);

      filter.$or = [
        { receiverName: { $regex: search, $options: 'i' } },
        { receiverDocument: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
      if (packageIds.length > 0) filter.$or.push({ packageId: { $in: packageIds } });
    }

    if (dateFrom || dateTo) {
      filter.deliveredAt = {};
      if (dateFrom) filter.deliveredAt.$gte = new Date(dateFrom);
      if (dateTo) filter.deliveredAt.$lte = new Date(dateTo);
    }

    return this.repository.findAll(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: [
        {
          path: 'packageId',
          select: 'tracking description weight status',
          populate: { path: 'customerId', select: 'name lastName' },
        },
        { path: 'deliveredById', select: 'name' },
      ],
    });
  }

  async completeDelivery(id, data, userId) {
    const delivery = await this.repository.findById(id);
    if (!delivery) throw new NotFoundException('Delivery');

    const pkg = await this.models.Package.findById(delivery.packageId);
    if (!pkg) throw new NotFoundException('Package');

    // Respect canonical status transitions — a package can only be finalized
    // as 'entregado' from a status that allows it (disponible / en_reparto).
    const allowedTargets = STATUS_TRANSITIONS[pkg.status] || [];
    if (!allowedTargets.includes('entregado')) {
      throw new ValidationException([{
        field: 'status',
        message: `Cannot complete delivery: package status '${pkg.status}' does not allow transition to 'entregado'`,
      }]);
    }

    // Whitelist updatable fields — never blindly assign arbitrary body keys.
    const UPDATABLE_FIELDS = ['receiverName', 'receiverDocument', 'receiverPhone', 'address', 'notes'];
    UPDATABLE_FIELDS.forEach((field) => {
      if (data[field] !== undefined) delivery[field] = data[field];
    });
    delivery.deliveredAt = new Date();
    await delivery.save();

    // Mark package as delivered and keep the reference so the event carries
    // the customer + tracking info the handlers need.
    pkg.status = 'entregado';
    pkg.deliveredAt = new Date();
    pkg.deliveredById = userId;
    await pkg.save();

    eventBus.emit(EVENTS.DELIVERY_COMPLETED, {
      delivery,
      package: pkg,
      userId,
      tenantSlug: this.tenantSlug,
    });

    return delivery;
  }

  async getToday(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.models.Delivery.find({
      deliveredById: userId,
      deliveredAt: { $gte: today, $lt: tomorrow },
    })
      .populate('packageId', 'tracking description weight receiverName receiverAddress')
      .sort({ deliveredAt: 1 });
  }

  async getStats(branchId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const filter = {};
    if (branchId) filter.branchId = branchId;

    const [total, todayDeliveries, byType, byDeliverer] = await Promise.all([
      this.repository.count(filter),
      this.repository.count({ ...filter, deliveredAt: { $gte: today } }),
      this.models.Delivery.aggregate([
        { $match: filter },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      this.models.Delivery.aggregate([
        { $match: filter },
        { $group: { _id: '$deliveredById', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return { total, today: todayDeliveries, byType, topDeliverers: byDeliverer };
  }
}

module.exports = DeliveryService;