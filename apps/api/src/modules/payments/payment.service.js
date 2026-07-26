const BaseRepository = require('../../repositories/base/base.repository');
const NotFoundException = require('../../exceptions/NotFoundException');
const ConflictException = require('../../exceptions/ConflictException');
const { eventBus, EVENTS } = require('../../events');
const receiptPdfService = require('../../services/upload/receiptPdf.service');

class PaymentService {
  constructor(models, tenantName) {
    this.models = models;
    this.tenantName = tenantName || 'Courier Service';
    this.repository = new BaseRepository(models.Payment);
    this.receiptRepo = new BaseRepository(models.Receipt);
  }

  async create(data, userId, userBranchId) {
    const packageIds = data.packages;
    const packages = await this.models.Package.find({ _id: { $in: packageIds } });
    if (packages.length !== packageIds.length) throw new NotFoundException('One or more packages not found');

    const customer = await this.models.Customer.findById(data.customerId);
    if (!customer) throw new NotFoundException('Customer');

    // Build receipt items from all packages
    const receiptItems = [];
    let subtotal = 0;
    let tax = 0;
    let totalAmount = 0;

    packages.forEach((pkg) => {
      receiptItems.push({
        description: `Envío #${pkg.tracking} - ${pkg.description || 'Sin descripción'}`,
        amount: pkg.cost,
        tax: pkg.tax,
        total: pkg.total,
      });
      subtotal += pkg.cost;
      tax += pkg.tax;
      totalAmount += pkg.total;
    });

    const payment = await this.repository.create({
      ...data,
      packages: packageIds,
      processedById: userId,
      branchId: userBranchId,
      status: 'paid',
      paidAt: new Date(),
    });

    // Mark all selected packages as paid if this payment covers the total
    if (payment.amount >= totalAmount) {
      await this.models.Package.updateMany(
        { _id: { $in: packageIds } },
        { $set: { isPaid: true, paymentId: payment._id } }
      );
    }

    // Generate receipt number
    const receiptNum = await this._generateReceiptNumber();
    payment.receiptNumber = receiptNum;
    await payment.save();

    // Create receipt record
    const receipt = await this.receiptRepo.create({
      receiptNumber: receiptNum,
      paymentId: payment._id,
      customerId: customer._id,
      packages: packageIds,
      items: receiptItems,
      subtotal,
      tax,
      total: totalAmount,
      method: data.method,
      generatedById: userId,
      pdfUrl: null,
    });

    // Generate PDF receipt (async, non-blocking)
    receiptPdfService.generateReceipt({
      receiptNumber: receiptNum,
      companyName: this.tenantName,
      customer: customer.toObject(),
      packages: packages.map((p) => p.toObject()),
      payment: payment.toObject(),
      items: receiptItems,
      subtotal,
      tax,
      total: totalAmount,
    }).then((pdfUrl) => {
      if (pdfUrl) {
        this.models.Receipt.findByIdAndUpdate(receipt._id, { pdfUrl }).catch((err) => {
          const logger = require('../../logs/logger');
          logger.error('Failed to update receipt pdfUrl: %s', err.message);
        });
      }
    }).catch(() => {
      // PDF generation is best-effort
    });

    packages.forEach((pkg) => {
      eventBus.emit(EVENTS.PAYMENT_RECEIVED, { payment, package: pkg, userId });
    });

    return payment.populate(['packages', 'customerId']);
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
    if (packageId) filter.packages = { $in: [packageId] };
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
        { path: 'packages', select: 'tracking total description' },
        { path: 'customerId', select: 'name lastName code' },
        { path: 'processedById', select: 'name' },
      ],
    });
  }

  async findById(id) {
    const payment = await this.models.Payment.findById(id)
      .populate('packages', 'tracking description weight cost tax total status')
      .populate('customerId', 'name lastName code document phone')
      .populate('processedById', 'name');

    if (!payment) throw new NotFoundException('Payment');

    const receipt = await this.models.Receipt.findOne({ paymentId: id });
    return { ...payment.toObject(), receipt };
  }

  async getDailySummary(date) {
    let dayStart, dayEnd;

    if (date) {
      // Build local-midnight dates from YYYY-MM-DD to avoid UTC parsing issues
      const [y, m, d] = date.split('-').map(Number);
      dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
      dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
    }

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