const BaseRepository = require('../../repositories/base/base.repository');
const NotFoundException = require('../../exceptions/NotFoundException');
const HttpException = require('../../exceptions/HttpException');

const MAX_DEVICE_TOKENS = 5;

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

    const result = await this.packageRepo.findAll(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: { createdAt: -1 },
      select: 'tracking carrierTracking description weight total status createdAt deliveredAt photos',
    });

    // Amount-to-pay disclosure (client-panel-specs): expose total + currency
    // ONLY for packages with status `disponible`. Other statuses get the raw
    // amount fields stripped so the client never sees intermediate costs.
    const hasDisponible = result.data.some((p) => p.status === 'disponible');
    let currency = 'DOP';
    if (hasDisponible) {
      const currencySetting = await this.models.Setting.findOne({ key: 'currency' });
      if (currencySetting) currency = currencySetting.value;
    }

    for (const pkg of result.data) {
      if (pkg.status === 'disponible') {
        pkg.amountToPay = pkg.total;
        pkg.currency = currency;
      }
      delete pkg.total;
    }

    return result;
  }

  async getPackageByTracking(tracking, customerId) {
    const pkg = await this.models.Package.findOne({ tracking, customerId })
      .populate('branchId', 'name address phone');

    if (!pkg) throw new NotFoundException('Package');

    const history = await this.models.PackageHistory.find({ packageId: pkg._id })
      .sort({ createdAt: -1 })
      .populate('changedBy', 'name')
      .lean();

    const result = { ...pkg.toObject(), history };

    // Amount-to-pay disclosure (client-panel-specs delta): the stored total +
    // pickup branch are exposed ONLY when the package is sitting at `disponible`.
    // Any other status leaks none of that (no amount-to-pay field and the raw
    // amount-bearing fields are stripped from the response).
    if (pkg.status === 'disponible') {
      const branch = pkg.branchId;
      result.amountToPay = pkg.total;
      result.pickupBranch = branch
        ? { id: branch._id, name: branch.name, address: branch.address }
        : null;
      // Tenant currency so clients format the disclosed amount correctly.
      const currencySetting = await this.models.Setting.findOne({ key: 'currency' });
      result.currency = currencySetting ? currencySetting.value : 'DOP';
    } else {
      for (const field of ['total', 'cost', 'shippingCost', 'tax', 'declaredValue']) {
        delete result[field];
      }
    }

    return result;
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
      { customerId, channel: { $in: ['in_app', 'push'] } },
      { page: Number(page), limit: Number(limit), sort: { createdAt: -1 } }
    );
  }

  /**
   * Register a push device token on the client's User (push-notifications spec,
   * design D11). Embedded `deviceTokens[{token,platform,createdAt,updatedAt}]`
   * are deduplicated by token (idempotent re-registration refreshes platform +
   * updatedAt) and capped at 5 distinct devices (HTTP 400 beyond that).
   */
  async registerDeviceToken(userId, { token, platform }) {
    const user = await this.models.User.findById(userId);
    if (!user) throw new NotFoundException('User');

    user.deviceTokens = user.deviceTokens || [];

    const existing = user.deviceTokens.find((dt) => dt.token === token);
    if (existing) {
      existing.platform = platform;
      existing.updatedAt = new Date();
      await user.save();
      return { registered: true, devices: user.deviceTokens.length };
    }

    if (user.deviceTokens.length >= MAX_DEVICE_TOKENS) {
      throw new HttpException(400, `Device token limit reached: max ${MAX_DEVICE_TOKENS}`, 'DEVICE_LIMIT_REACHED');
    }

    user.deviceTokens.push({
      token,
      platform,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await user.save();
    return { registered: true, devices: user.deviceTokens.length };
  }
}

module.exports = ClientService;