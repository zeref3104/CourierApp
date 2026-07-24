const settingService = require('./setting.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const settingController = {
  findAll: asyncHandler(async (req, res) => {
    const settings = await settingService.findAll(req.tenantModels);
    apiResponse.success(res, settings);
  }),

  update: asyncHandler(async (req, res) => {
    const settings = await settingService.update(req.body, req.user._id, req.tenantModels);
    apiResponse.success(res, settings, 'Settings updated');
  }),

  uploadLogo: asyncHandler(async (req, res) => {
    const url = await settingService.uploadLogo(req.file, req.tenantModels);
    apiResponse.success(res, { logoUrl: url }, 'Logo uploaded');
  }),

  getPublic: asyncHandler(async (req, res) => {
    const settings = await settingService.getPublic(req.tenantModels);
    apiResponse.success(res, settings);
  }),
};

module.exports = settingController;