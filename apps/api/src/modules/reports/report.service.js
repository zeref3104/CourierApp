const ValidationException = require('../../exceptions/ValidationException');

function assertValidDate(value, field) {
  if (value === undefined || value === null || value === '') return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new ValidationException([{
      field,
      message: `${field} must be a valid date in YYYY-MM-DD format`,
    }]);
  }
  if (Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
    throw new ValidationException([{
      field,
      message: `${field} is not a valid date`,
    }]);
  }
}

class ReportService {
  constructor(models) {
    this.models = models;
  }

  async getCustomers(query = {}) {
    const { dateFrom, dateTo, branchId } = query;
    assertValidDate(dateFrom, 'dateFrom');
    assertValidDate(dateTo, 'dateTo');
    const filter = {};
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    if (branchId) filter.branchId = branchId;

    const [total, byDay] = await Promise.all([
      this.models.Customer.countDocuments(filter),
      this.models.Customer.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return { total, period: { from: dateFrom, to: dateTo }, byDay };
  }

  async getPackages(query = {}) {
    const { dateFrom, dateTo, status, branchId } = query;
    assertValidDate(dateFrom, 'dateFrom');
    assertValidDate(dateTo, 'dateTo');
    const filter = {};
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    if (status) filter.status = status;
    if (branchId) filter.branchId = branchId;

    const [total, byStatus, byDay, avgTime] = await Promise.all([
      this.models.Package.countDocuments(filter),
      this.models.Package.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.models.Package.aggregate([
        { $match: filter },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      this.models.Package.aggregate([
        { $match: { status: 'entregado', deliveredAt: { $ne: null }, ...filter } },
        {
          $project: {
            transitTime: { $subtract: ['$deliveredAt', '$createdAt'] },
          },
        },
        { $group: { _id: null, avgMs: { $avg: '$transitTime' } } },
      ]),
    ]);

    const avgHours = avgTime.length > 0 ? Math.round(avgTime[0].avgMs / (1000 * 60 * 60)) : 0;

    return { total, byStatus, byDay, averageTransitHours: avgHours };
  }

  async getIncome(query = {}) {
    const { dateFrom, dateTo, period = 'daily' } = query;
    assertValidDate(dateFrom, 'dateFrom');
    assertValidDate(dateTo, 'dateTo');
    const filter = { status: 'paid' };
    if (dateFrom || dateTo) {
      filter.paidAt = {};
      if (dateFrom) filter.paidAt.$gte = new Date(dateFrom);
      if (dateTo) filter.paidAt.$lte = new Date(dateTo);
    }

    const dateFormat = period === 'monthly' ? '%Y-%m' : period === 'weekly' ? '%Y-W%V' : '%Y-%m-%d';

    const [total, byMethod, byPeriod] = await Promise.all([
      this.models.Payment.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.models.Payment.aggregate([
        { $match: filter },
        { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.models.Payment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: '$paidAt' } },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return {
      totalIncome: total.length > 0 ? total[0].total : 0,
      byMethod,
      byPeriod,
    };
  }

  async getDeliveries(query = {}) {
    const { dateFrom, dateTo, type, deliveredById } = query;
    assertValidDate(dateFrom, 'dateFrom');
    assertValidDate(dateTo, 'dateTo');
    const filter = {};
    if (dateFrom || dateTo) {
      filter.deliveredAt = {};
      if (dateFrom) filter.deliveredAt.$gte = new Date(dateFrom);
      if (dateTo) filter.deliveredAt.$lte = new Date(dateTo);
    }
    if (type) filter.type = type;
    if (deliveredById) filter.deliveredById = deliveredById;

    const [total, byType, byDeliverer] = await Promise.all([
      this.models.Delivery.countDocuments(filter),
      this.models.Delivery.aggregate([{ $match: filter }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
      this.models.Delivery.aggregate([
        { $match: filter },
        { $group: { _id: '$deliveredById', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'deliverer',
          },
        },
        { $unwind: { path: '$deliverer', preserveNullAndEmptyArrays: true } },
        { $project: { name: '$deliverer.name', deliveries: '$count' } },
      ]),
    ]);

    return { total, byType, byDeliverer };
  }
}

module.exports = ReportService;