const DeliveryService = require('./delivery.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const deliveryController = {
  create: asyncHandler(async (req, res) => {
    const service = new DeliveryService(req.tenantModels);
    const delivery = await service.create(req.body, req.user._id);
    apiResponse.created(res, delivery, 'Delivery registered');
  }),

  findAll: asyncHandler(async (req, res) => {
    const service = new DeliveryService(req.tenantModels);
    const result = await service.findAll(req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  completeDelivery: asyncHandler(async (req, res) => {
    const service = new DeliveryService(req.tenantModels);
    const delivery = await service.completeDelivery(req.params.id, req.body, req.user._id);
    apiResponse.success(res, delivery, 'Delivery completed');
  }),

  getToday: asyncHandler(async (req, res) => {
    const service = new DeliveryService(req.tenantModels);
    const deliveries = await service.getToday(req.user._id);
    apiResponse.success(res, deliveries);
  }),

  getStats: asyncHandler(async (req, res) => {
    const service = new DeliveryService(req.tenantModels);
    const stats = await service.getStats(req.query.branchId);
    apiResponse.success(res, stats);
  }),
};

module.exports = deliveryController;