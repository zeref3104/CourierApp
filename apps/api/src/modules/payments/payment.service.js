const BaseRepository = require('../../repositories/base/base.repository');
const NotFoundException = require('../../exceptions/NotFoundException');
const ValidationException = require('../../exceptions/ValidationException');
const { eventBus, EVENTS } = require('../../events');
const receiptPdfService = require('../../services/upload/receiptPdf.service');
const { nextSequence } = require('../../services/tenant/counter.service');
const { generateReceiptNumber } = require('@courier/helpers');
const logger = require('../../logs/logger');

function toCents(value) {
  return Math.round(Number(value) * 100);
}

/**
 * Detect errors that mean "multi-document transactions are not supported".
 * MongoDB standalone deployments reject any command that carries a txnNumber:
 *   - driver-side:  MongoRuntimeError 'Transactions are not supported in single-topology deployments'
 *   - server-side:  error codeName 'TransactionNumbersNotAllowed' / 'IllegalOperation'
 *                   with message 'Transaction numbers are only allowed on a replica set member or mongos'
 */
function isTransactionsUnsupportedError(err) {
  if (!err) return false;
  const message = err.message || '';
  return (
    err.codeName === 'TransactionNumbersNotAllowed' ||
    err.codeName === 'IllegalOperation' ||
    /Transaction numbers are only allowed on a replica set/i.test(message) ||
    /Transactions are not supported/i.test(message)
  );
}

/**
 * Detect transient transaction failures caused by concurrent writes on
 * overlapping data (two payments touching the same package/counter). The
 * server aborts one of them with the TransientTransactionError label (or a
 * WriteConflict, code 112). These are safe to retry with a fresh snapshot.
 */
function isTransientTransactionError(err) {
  if (!err) return false;
  const message = err.message || '';
  return (
    (Array.isArray(err.errorLabels) && err.errorLabels.includes('TransientTransactionError')) ||
    err.codeName === 'WriteConflict' ||
    err.code === 112 ||
    /TransientTransactionError/i.test(message) ||
    /WriteConflict/i.test(message)
  );
}

const MAX_TRANSACTION_ATTEMPTS = 3;
const TRANSACTION_RETRY_DELAY_MS = 100;

class PaymentService {
  constructor(models, tenantName, tenantSlug) {
    this.models = models;
    this.tenantName = tenantName || 'Courier Service';
    this.tenantSlug = tenantSlug;
    this.repository = new BaseRepository(models.Payment);
  }

  async create(data, userId, userBranchId) {
    const session = await this.models.Payment.db.startSession();

    let transactionStarted = false;
    try {
      session.startTransaction();
      transactionStarted = true;
    } catch (err) {
      // Client-side rejection (e.g. invalid TransactionOptions, or the driver
      // rejecting transactions on a single-topology/standalone deployment).
      if (!isTransactionsUnsupportedError(err)) {
        session.endSession();
        throw err;
      }
    }

    try {
      if (transactionStarted) {
        for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
          try {
            return await this._runTransactional(session, data, userId, userBranchId);
          } catch (err) {
            await session.abortTransaction().catch(() => {});
            // Concurrent overlapping payments abort with a transient
            // TransientTransactionError / WriteConflict. Retry the whole
            // transaction with a small backoff; each attempt gets fresh reads.
            if (isTransientTransactionError(err)) {
              if (attempt < MAX_TRANSACTION_ATTEMPTS) {
                await new Promise((resolve) => setTimeout(resolve, TRANSACTION_RETRY_DELAY_MS * attempt));
                session.startTransaction();
                continue;
              }
              throw err;
            }
            // Standalone mongo: fall through to the best-effort path below.
            if (!isTransactionsUnsupportedError(err)) throw err;
            break;
          }
        }
      }

      logger.warn(
        'MongoDB transactions are not available (standalone instance detected). ' +
        'Payment creation will continue WITHOUT atomicity. Configure the database as a ' +
        'single-node replica set (see docker/docker-compose.yml) to enable transactions.'
      );

      return await this._runBestEffort(data, userId, userBranchId);
    } finally {
      session.endSession();
    }
  }

  /**
   * Transactional path (primary). Every read+write runs on the session so the
   * whole payment (Payment + Package updates + Receipt + counter) commits or
   * aborts atomically. Shared step logic lives in _loadPaymentInputs /
   * _afterCommit so the fallback path behaves identically.
   */
  async _runTransactional(session, data, userId, userBranchId) {
    const { packages, customer, receiptItems, subtotal, tax, totalAmount, currency } =
      await this._loadPaymentInputs(data, session);

    // Generate the receipt number INSIDE the transaction so concurrent
    // payments can never receive the same number (atomic counter).
    const receiptNum = await this._generateReceiptNumber(session);

    const payment = await this.models.Payment.create([{
      ...data,
      packages: data.packages,
      processedById: userId,
      branchId: userBranchId,
      status: 'paid',
      paidAt: new Date(),
      receiptNumber: receiptNum,
    }], { session });

    // Mark all selected packages as paid (amount == total by validation)
    await this.models.Package.updateMany(
      { _id: { $in: data.packages } },
      { $set: { isPaid: true, paymentId: payment[0]._id } }
    ).session(session);

    // Create receipt record
    await this.models.Receipt.create([{
      receiptNumber: receiptNum,
      paymentId: payment[0]._id,
      customerId: customer._id,
      packages: data.packages,
      items: receiptItems,
      subtotal,
      tax,
      total: totalAmount,
      method: data.method,
      generatedById: userId,
      pdfUrl: null,
    }], { session });

    await session.commitTransaction();

    return this._afterCommit({ payment: payment[0], customer, packages, receiptItems, subtotal, tax, totalAmount, currency, userId });
  }

  /**
   * Best-effort fallback for standalone MongoDB deployments that do not
   * support multi-document transactions. Reuses the same step logic; the only
   * difference is that writes are NOT atomic (a crash mid-flow can leave the
   * payment without its receipt or the packages unmarked).
   */
  async _runBestEffort(data, userId, userBranchId) {
    const { packages, customer, receiptItems, subtotal, tax, totalAmount } =
      await this._loadPaymentInputs(data);

    const receiptNum = await this._generateReceiptNumber();

    const payment = await this.models.Payment.create([{
      ...data,
      packages: data.packages,
      processedById: userId,
      branchId: userBranchId,
      status: 'paid',
      paidAt: new Date(),
      receiptNumber: receiptNum,
    }]);

    await this.models.Package.updateMany(
      { _id: { $in: data.packages } },
      { $set: { isPaid: true, paymentId: payment[0]._id } }
    );

    await this.models.Receipt.create([{
      receiptNumber: receiptNum,
      paymentId: payment[0]._id,
      customerId: customer._id,
      packages: data.packages,
      items: receiptItems,
      subtotal,
      tax,
      total: totalAmount,
      method: data.method,
      generatedById: userId,
      pdfUrl: null,
    }]);

    return this._afterCommit({ payment: payment[0], customer, packages, receiptItems, subtotal, tax, totalAmount, userId });
  }

  /**
   * Shared validation + pricing step used by both paths. When a session is
   * provided the reads run inside the transaction.
   */
  async _loadPaymentInputs(data, session) {
    // Dedupe so a client repeating an id cannot bypass the count check below.
    const packageIds = [...new Set(data.packages)];
    const withSession = (query) => (session ? query.session(session) : query);

    const packages = await withSession(
      this.models.Package.find({
        _id: { $in: packageIds },
        customerId: data.customerId,
        isPaid: { $ne: true },
      })
    );
    if (packages.length !== packageIds.length) {
      throw new ValidationException([{
        field: 'packages',
        message: 'One or more packages are not payable (not found, already paid, or belonging to another customer)',
      }]);
    }

    const customer = await withSession(this.models.Customer.findById(data.customerId));
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

    // Server-side pricing is the source of truth: the client-supplied amount
    // is not trusted. Reject underpayments AND overpayments — the system has
    // no partial-payment or overpayment/credit concept, so the amount must
    // equal the computed package total exactly.
    if (toCents(data.amount) !== toCents(totalAmount)) {
      throw new ValidationException([{
        field: 'amount',
        message: `Payment amount must equal the computed total of ${Number(totalAmount).toFixed(2)} ` +
          `(packages: ${Number(subtotal).toFixed(2)} + tax: ${Number(tax).toFixed(2)})`,
      }]);
    }

    return { packages, customer, receiptItems, subtotal, tax, totalAmount };
  }

  /**
   * Shared post-commit work for both paths: async PDF generation (best-effort),
   * the single payment event, and the populated response.
   */
  _afterCommit({ payment: savedPayment, customer, packages, receiptItems, subtotal, tax, totalAmount, userId }) {
    // Generate PDF receipt (async, best-effort AFTER the writes land)
    receiptPdfService.generateReceipt({
      receiptNumber: savedPayment.receiptNumber,
      companyName: this.tenantName,
      customer: customer.toObject(),
      packages: packages.map((p) => p.toObject()),
      payment: savedPayment.toObject(),
      items: receiptItems,
      subtotal,
      tax,
      total: totalAmount,
    }).then((pdfUrl) => {
      if (pdfUrl) {
        this.models.Receipt.findOneAndUpdate({ paymentId: savedPayment._id }, { pdfUrl }).catch(() => {});
      }
    }).catch(() => {
      // PDF generation is best-effort
    });

    // Emit ONE payment event carrying every package id — emitting per
    // package caused duplicate ActivityLogs for multi-package payments.
    eventBus.emit(EVENTS.PAYMENT_RECEIVED, {
      payment: savedPayment,
      packages,
      userId,
      tenantSlug: this.tenantSlug,
    });

    return savedPayment.populate(['packages', 'customerId']);
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new ValidationException([{
          field: 'date',
          message: 'date must be a valid date in YYYY-MM-DD format',
        }]);
      }
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

    const [methodTotals, pendingCount] = await Promise.all([
      this.models.Payment.aggregate([
        { $match: { paidAt: { $gte: dayStart, $lte: dayEnd }, status: 'paid' } },
        { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      this.models.Payment.countDocuments({ status: 'pending' }),
    ]);

    const byMethod = { cash: 0, card: 0, transfer: 0 };
    let totalCollected = 0;
    let transactionCount = 0;

    methodTotals.forEach((row) => {
      if (byMethod[row._id] !== undefined) byMethod[row._id] = row.total;
      totalCollected += row.total;
      transactionCount += row.count;
    });

    return {
      totalCollected,
      byMethod,
      transactionCount,
      pendingCount,
    };
  }

  async _generateReceiptNumber(session) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const seq = await nextSequence(this.models, `receipt-${date}`, {
      seedFrom: async (s) => {
        const query = this.models.Receipt.findOne({
          receiptNumber: new RegExp(`^RCP-${date}-`),
        }).sort({ receiptNumber: -1 }).select('receiptNumber');
        const last = s ? await query.session(s) : await query;
        return last ? parseInt(last.receiptNumber.split('-').pop(), 10) : 0;
      },
      session,
    });

    return generateReceiptNumber({ seq, date });
  }
}

module.exports = PaymentService;