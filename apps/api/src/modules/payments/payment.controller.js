const PaymentService = require('./payment.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const paymentController = {
  create: asyncHandler(async (req, res) => {
    const service = new PaymentService(req.tenantModels);
    const payment = await service.create(req.body, req.user);
    apiResponse.created(res, payment, 'Payment registered');
  }),

  findAll: asyncHandler(async (req, res) => {
    const service = new PaymentService(req.tenantModels);
    const result = await service.findAll(req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  findById: asyncHandler(async (req, res) => {
    const service = new PaymentService(req.tenantModels);
    const payment = await service.findById(req.params.id);
    apiResponse.success(res, payment);
  }),

  getDailySummary: asyncHandler(async (req, res) => {
    const service = new PaymentService(req.tenantModels);
    const summary = await service.getDailySummary(req.query.date);
    apiResponse.success(res, summary);
  }),
};

module.exports = paymentController;