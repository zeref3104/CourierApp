const BaseRepository = require('../../repositories/base/base.repository');
const NotFoundException = require('../../exceptions/NotFoundException');
const ConflictException = require('../../exceptions/ConflictException');
const { eventBus, EVENTS } = require('../../events');

class PaymentService {
  constructor(models) {
    this.models = models;
    this.repository = new BaseRepository(models.Payment);
    this.receiptRepo = new BaseRepository(models.Receipt);
  }

  async create(data, userId) {
    const pkg = await this.models.Package.findById(data.packageId);
    if (!pkg) throw new NotFoundException('Package');

    const customer = await this.models.Customer.findById(data.customerId);
    if (!customer) throw new NotFoundException('Customer');

    // Calculate total paid so far
    const totalPaid = await this.models.Payment.aggregate([
      { $match: { packageId: pkg._id, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const paidSoFar = totalPaid.length ? totalPaid[0].total : 0;
    const newTotalPaid = paidSoFar + data.amount;

    const payment = await this.repository.create({
      ...data,
      processedById: userId,
      branchId: userId?.branchId,
      status: 'paid',
      paidAt: new Date(),
    });

    // Update package payment status
    if (newTotalPaid >= pkg.total) {
      await this.models.Package.findByIdAndUpdate(pkg._id, {
        isPaid: true,
        paymentId: payment._id,
      });
    }

    // Generate receipt number
    const receiptNum = await this._generateReceiptNumber();
    payment.receiptNumber = receiptNum;
    await payment.save();

    // Create receipt record
    await this.receiptRepo.create({
      receiptNumber: receiptNum,
      paymentId: payment._id,
      customerId: customer._id,
      packageId: pkg._id,
      items: [{
        description: `Envío #${pkg.tracking} - ${pkg.description}`,
        amount: pkg.cost,
        tax: pkg.tax,
        total: pkg.total,
      }],
      subtotal: pkg.cost,
      tax: pkg.tax,
      total: pkg.total,
      method: data.method,
      generatedById: userId,
      pdfUrl: null,
    });

    eventBus.emit(EVENTS.PAYMENT_RECEIVED, { payment, package: pkg, userId });

    return payment.populate(['packageId', 'customerId']);
  }

  async findAll(query = {}) {
    const {
      page = 1, limit = 20, status, method,
      dateFrom, dateTo, customerId, packageId,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = query;

    const filter = {};
    if (status) filter.status = status;
    if (method) filter.method = method;
    if (customerId) filter.customerId = customerId;
    if (packageId) filter.packageId = packageId;
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
        { path: 'packageId', select: 'tracking total' },
        { path: 'customerId', select: 'name lastName code' },
        { path: 'processedById', select: 'name' },
      ],
    });
  }

  async findById(id) {
    const payment = await this.models.Payment.findById(id)
      .populate('packageId', 'tracking description weight total status')
      .populate('customerId', 'name lastName code document phone')
      .populate('processedById', 'name');

    if (!payment) throw new NotFoundException('Payment');

    const receipt = await this.models.Receipt.findOne({ paymentId: id });
    return { ...payment.toObject(), receipt };
  }

  async getDailySummary(date) {
    const dayStart = date ? new Date(date) : new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const payments = await this.models.Payment.find({
      paidAt: { $gte: dayStart, $lte: dayEnd },
      status: 'paid',
    });

    const summary = {
      totalCollected: payments.reduce((s, p) => s + p.amount, 0),
      byMethod: { cash: 0, card: 0, transfer: 0 },
      transactionCount: payments.length,
    };

    payments.forEach((p) => {
      if (summary.byMethod[p.method] !== undefined) {
        summary.byMethod[p.method] += p.amount;
      }
    });

    const pendingCount = await this.models.Payment.countDocuments({
      status: 'pending',
    });

    summary.pendingCount = pendingCount;

    return summary;
  }

  async _generateReceiptNumber() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.repository.count({
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
      },
    });
    return `RCP-${date}-${String(count + 1).padStart(4, '0')}`;
  }
}

module.exports = PaymentService;