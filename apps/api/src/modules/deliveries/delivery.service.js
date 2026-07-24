const BaseRepository = require('../../repositories/base/base.repository');
const NotFoundException = require('../../exceptions/NotFoundException');
const { eventBus, EVENTS } = require('../../events');

class DeliveryService {
  constructor(models) {
    this.models = models;
    this.repository = new BaseRepository(models.Delivery);
  }

  async create(data, userId) {
    const pkg = await this.models.Package.findById(data.packageId);
    if (!pkg) throw new NotFoundException('Package');

    if (!['disponible', 'en_reparto'].includes(pkg.status)) {
      throw new NotFoundException('Package is not available for delivery');
    }

    const delivery = await this.repository.create({
      ...data,
      deliveredById: userId,
      deliveredAt: new Date(),
    });

    // Update package status
    if (data.type === 'branch') {
      pkg.status = 'entregado';
      pkg.deliveredAt = new Date();
      pkg.deliveredById = userId;
    } else {
      pkg.status = 'en_reparto';
    }
    await pkg.save();

    eventBus.emit(EVENTS.DELIVERY_COMPLETED, { delivery, package: pkg, userId });

    return delivery.populate(['packageId', 'deliveredById']);
  }

  async findAll(query = {}) {
    const {
      page = 1, limit = 20, type, dateFrom, dateTo,
      branchId, deliveredById, sortBy = 'deliveredAt', sortOrder = 'desc',
    } = query;

    const filter = {};
    if (type) filter.type = type;
    if (branchId) filter.branchId = branchId;
    if (deliveredById) filter.deliveredById = deliveredById;
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
        { path: 'packageId', select: 'tracking description weight status' },
        { path: 'deliveredById', select: 'name' },
      ],
    });
  }

  async completeDelivery(id, data, userId) {
    const delivery = await this.repository.findById(id);
    if (!delivery) throw new NotFoundException('Delivery');

    Object.assign(delivery, data);
    delivery.deliveredAt = new Date();
    await delivery.save();

    // Mark package as delivered
    await this.models.Package.findByIdAndUpdate(delivery.packageId, {
      status: 'entregado',
      deliveredAt: new Date(),
      deliveredById: userId,
    });

    eventBus.emit(EVENTS.DELIVERY_COMPLETED, { delivery, userId });

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