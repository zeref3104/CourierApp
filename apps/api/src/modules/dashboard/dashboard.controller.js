const DashboardService = require('./dashboard.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const dashboardController = {
  summary: asyncHandler(async (req, res) => {
    const service = new DashboardService(req.tenantModels);
    const summary = await service.getSummary();
    apiResponse.success(res, summary);
  }),

  charts: asyncHandler(async (req, res) => {
    const service = new DashboardService(req.tenantModels);
    const charts = await service.getCharts(req.query.period);
    apiResponse.success(res, charts);
  }),

  recent: asyncHandler(async (req, res) => {
    const service = new DashboardService(req.tenantModels);
    const activity = await service.getRecent(req.query.limit);
    apiResponse.success(res, activity);
  }),
};

module.exports = dashboardController;