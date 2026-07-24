class DashboardService {
  constructor(models) {
    this.models = models;
  }

  async getSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalCustomers,
      packagesReceivedToday,
      inTransit,
      ready,
      deliveredToday,
      revenueToday,
      pendingPayments,
      recentActivity,
    ] = await Promise.all([
      this.models.Customer.countDocuments({ isActive: true }),
      this.models.Package.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
      this.models.Package.countDocuments({
        status: { $in: ['en_transito', 'llego_rd', 'almacen_rd'] },
      }),
      this.models.Package.countDocuments({ status: 'disponible' }),
      this.models.Package.countDocuments({
        status: 'entregado',
        deliveredAt: { $gte: today, $lt: tomorrow },
      }),
      this.models.Payment.aggregate([
        { $match: { status: 'paid', paidAt: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.models.Payment.aggregate([
        { $match: { status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.models.ActivityLog.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name')
        .lean(),
    ]);

    return {
      totalCustomers,
      packagesReceivedToday,
      inTransit,
      packagesReady: ready,
      deliveredToday,
      revenueToday: revenueToday.length ? revenueToday[0].total : 0,
      pendingPayments: {
        count: pendingPayments.length ? pendingPayments[0].count : 0,
        amount: pendingPayments.length ? pendingPayments[0].total : 0,
      },
      recentActivity,
    };
  }

  async getCharts(period = '30d') {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    const days = daysMap[period] || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [packagesByStatus, revenueByDay, packagesByDay, topCustomers] = await Promise.all([
      this.models.Package.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.models.Payment.aggregate([
        { $match: { status: 'paid', paidAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.models.Package.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.models.Package.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$customerId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'customers',
            localField: '_id',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: '$customer' },
        {
          $project: {
            _id: 0,
            name: { $concat: ['$customer.name', ' ', '$customer.lastName'] },
            code: '$customer.code',
            packages: '$count',
          },
        },
      ]),
    ]);

    return { packagesByStatus, revenueByDay, packagesByDay, topCustomers };
  }

  async getRecent(limit = 20) {
    return this.models.ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'name')
      .lean();
  }
}

module.exports = DashboardService;