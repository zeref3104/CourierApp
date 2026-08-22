const licenseService = require('./license.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const licenseController = {
  create: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const license = await licenseService.create(req.body, masterConnection);
    apiResponse.created(res, license, 'License created');
  }),

  findAll: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const result = await licenseService.findAll(req.query, masterConnection);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  findById: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const license = await licenseService.findById(req.params.id, masterConnection);
    apiResponse.success(res, license);
  }),

  update: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const license = await licenseService.update(req.params.id, req.body, masterConnection);
    apiResponse.success(res, license, 'License updated');
  }),

  delete: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const result = await licenseService.delete(req.params.id, masterConnection);
    apiResponse.success(res, result, 'License deleted');
  }),
};

module.exports = licenseController;
