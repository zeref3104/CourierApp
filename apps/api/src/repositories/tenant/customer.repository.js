const BaseRepository = require('../base/base.repository');

class CustomerRepository extends BaseRepository {
  constructor(connection) {
    super(connection.model('Customer'));
    this.packageModel = connection.model('Package');
    this.paymentModel = connection.model('Payment');
  }

  async findByCode(code) {
    return this.model.findOne({ code });
  }

  async findByEmail(email) {
    return this.model.findOne({ email });
  }

  async search(query, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    const filter = { isActive: true };

    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { document: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { code: { $regex: query, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('branchId', 'name'),
      this.model.countDocuments(filter),
    ]);

    return {
      data,
      meta: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCustomerSummary(customerId) {
    const [totalPackages, pendingPackages, deliveredPackages, payments] = await Promise.all([
      this.packageModel.countDocuments({ customerId }),
      this.packageModel.countDocuments({ customerId, status: { $nin: ['entregado', 'cancelado', 'extraviado'] } }),
      this.packageModel.countDocuments({ customerId, status: 'entregado' }),
      this.paymentModel.find({ customerId }),
    ]);

    const totalPaid = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const pendingBalance = payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

    return { totalPackages, pendingPackages, deliveredPackages, totalPaid, pendingBalance };
  }

  async getNextCode() {
    const last = await this.model.findOne({}).sort({ createdAt: -1 }).select('code');
    const num = last ? parseInt(last.code.split('-')[1], 10) + 1 : 1;
    return `CUS-${String(num).padStart(4, '0')}`;
  }
}

module.exports = CustomerRepository;