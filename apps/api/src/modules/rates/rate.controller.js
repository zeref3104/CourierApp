const rateService = require('./rate.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const rateController = {
  create: asyncHandler(async (req, res) => {
    const rate = await rateService.create(req.body, req.tenantModels);
    apiResponse.created(res, rate, 'Rate created');
  }),

  findAll: asyncHandler(async (req, res) => {
    const rates = await rateService.findAll(req.tenantModels);
    apiResponse.success(res, rates);
  }),

  findById: asyncHandler(async (req, res) => {
    const rate = await rateService.findById(req.params.id, req.tenantModels);
    apiResponse.success(res, rate);
  }),

  update: asyncHandler(async (req, res) => {
    const rate = await rateService.update(req.params.id, req.body, req.tenantModels);
    apiResponse.success(res, rate, 'Rate updated');
  }),

  getActive: asyncHandler(async (req, res) => {
    const rate = await rateService.getActive(req.tenantModels);
    apiResponse.success(res, rate);
  }),
};

module.exports = rateController;