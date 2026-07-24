const ReportService = require('./report.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const reportController = {
  customers: asyncHandler(async (req, res) => {
    const service = new ReportService(req.tenantModels);
    const data = await service.getCustomers(req.query);
    apiResponse.success(res, data);
  }),

  packages: asyncHandler(async (req, res) => {
    const service = new ReportService(req.tenantModels);
    const data = await service.getPackages(req.query);
    apiResponse.success(res, data);
  }),

  income: asyncHandler(async (req, res) => {
    const service = new ReportService(req.tenantModels);
    const data = await service.getIncome(req.query);
    apiResponse.success(res, data);
  }),

  deliveries: asyncHandler(async (req, res) => {
    const service = new ReportService(req.tenantModels);
    const data = await service.getDeliveries(req.query);
    apiResponse.success(res, data);
  }),
};

module.exports = reportController;