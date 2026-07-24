const ClientService = require('./client.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const clientController = {
  dashboard: asyncHandler(async (req, res) => {
    const service = new ClientService(req.tenantModels);
    const data = await service.getDashboard(req.user.clientId);
    apiResponse.success(res, data);
  }),

  packages: asyncHandler(async (req, res) => {
    const service = new ClientService(req.tenantModels);
    const result = await service.getPackages(req.user.clientId, req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  packageDetail: asyncHandler(async (req, res) => {
    const service = new ClientService(req.tenantModels);
    const pkg = await service.getPackageByTracking(req.params.tracking, req.user.clientId);
    apiResponse.success(res, pkg);
  }),

  profile: asyncHandler(async (req, res) => {
    const service = new ClientService(req.tenantModels);
    const profile = await service.getProfile(req.user.clientId);
    apiResponse.success(res, profile);
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const service = new ClientService(req.tenantModels);
    const profile = await service.updateProfile(req.user.clientId, req.body);
    apiResponse.success(res, profile, 'Profile updated');
  }),

  notifications: asyncHandler(async (req, res) => {
    const service = new ClientService(req.tenantModels);
    const result = await service.getNotifications(req.user.clientId, req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  miamiAddress: asyncHandler(async (req, res) => {
    const service = new ClientService(req.tenantModels);
    const data = await service.getMiamiAddress(req.user.clientId);
    apiResponse.success(res, data);
  }),

  code: asyncHandler(async (req, res) => {
    const service = new ClientService(req.tenantModels);
    const profile = await service.getProfile(req.user.clientId);
    apiResponse.success(res, { code: profile.code });
  }),
};

module.exports = clientController;