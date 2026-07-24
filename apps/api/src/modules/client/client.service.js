const BaseRepository = require('../../repositories/base/base.repository');
const NotFoundException = require('../../exceptions/NotFoundException');

class ClientService {
  constructor(models) {
    this.models = models;
    this.packageRepo = new BaseRepository(models.Package);
  }

  async getDashboard(customerId) {
    const [totalPackages, inTransit, delivered, readyForPickup, lastFive] = await Promise.all([
      this.packageRepo.count({ customerId }),
      this.models.Package.countDocuments({
        customerId,
        status: { $in: ['en_transito', 'llego_rd', 'almacen_rd'] },
      }),
      this.models.Package.countDocuments({ customerId, status: 'entregado' }),
      this.models.Package.countDocuments({ customerId, status: 'disponible' }),
      this.models.Package.find({ customerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('tracking status createdAt')
        .lean(),
    ]);

    return { totalPackages, inTransit, delivered, readyForPickup, lastTracking: lastFive };
  }

  async getPackages(customerId, query = {}) {
    const { page = 1, limit = 20, status, search } = query;
    const filter = { customerId };

    if (status) filter.status = status;
    if (search) {
      filter.tracking = { $regex: search, $options: 'i' };
    }

    return this.packageRepo.findAll(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: { createdAt: -1 },
      select: 'tracking description weight status cost total createdAt deliveredAt photos',
    });
  }

  async getPackageByTracking(tracking, customerId) {
    const pkg = await this.models.Package.findOne({ tracking, customerId })
      .populate('branchId', 'name address phone');

    if (!pkg) throw new NotFoundException('Package');

    const history = await this.models.PackageHistory.find({ packageId: pkg._id })
      .sort({ createdAt: -1 })
      .populate('changedBy', 'name')
      .lean();

    return { ...pkg.toObject(), history };
  }

  async getProfile(customerId) {
    const customer = await this.models.Customer.findById(customerId)
      .populate('branchId', 'name address phone');
    if (!customer) throw new NotFoundException('Customer');
    return customer;
  }

  async updateProfile(customerId, data) {
    const customer = await this.models.Customer.findById(customerId);
    if (!customer) throw new NotFoundException('Customer');

    if (data.email) customer.email = data.email;
    if (data.phone) customer.phone = data.phone;
    if (data.address) customer.address = data.address;

    return customer.save();
  }

  async getMiamiAddress(customerId) {
    const customer = await this.models.Customer.findById(customerId).select('miamiAddress code');
    if (!customer) throw new NotFoundException('Customer');

    const settings = await this.models.Setting.findOne({ key: 'company_name' });

    return {
      miamiAddress: customer.miamiAddress || 'No Miami address assigned',
      customerCode: customer.code,
      companyName: settings?.value || '',
    };
  }

  async getNotifications(customerId, query = {}) {
    const { page = 1, limit = 20 } = query;
    const repo = new BaseRepository(this.models.Notification);
    return repo.findAll(
      { customerId, channel: 'in_app' },
      { page: Number(page), limit: Number(limit), sort: { createdAt: -1 } }
    );
  }
}

module.exports = ClientService;