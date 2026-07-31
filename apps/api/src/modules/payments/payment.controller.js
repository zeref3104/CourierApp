const PaymentService = require('./payment.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const paymentController = {
  create: asyncHandler(async (req, res) => {
    const service = new PaymentService(req.tenantModels, req.tenant?.name, req.tenant?.slug);
    const payment = await service.create(req.body, req.user._id, req.user.branchId);
    apiResponse.created(res, payment, 'Payment registered');
  }),

  findAll: asyncHandler(async (req, res) => {
    const service = new PaymentService(req.tenantModels, req.tenant?.name, req.tenant?.slug);
    const result = await service.findAll(req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  findById: asyncHandler(async (req, res) => {
    const service = new PaymentService(req.tenantModels, req.tenant?.name, req.tenant?.slug);
    const payment = await service.findById(req.params.id);
    apiResponse.success(res, payment);
  }),

  getDailySummary: asyncHandler(async (req, res) => {
    const service = new PaymentService(req.tenantModels, req.tenant?.name, req.tenant?.slug);
    const summary = await service.getDailySummary(req.query.date);
    apiResponse.success(res, summary);
  }),
};

module.exports = paymentController;