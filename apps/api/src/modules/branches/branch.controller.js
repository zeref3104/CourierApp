const branchService = require('./branch.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const branchController = {
  create: asyncHandler(async (req, res) => {
    const branch = await branchService.create(req.body, req.tenantModels);
    apiResponse.created(res, branch, 'Branch created');
  }),

  findAll: asyncHandler(async (req, res) => {
    const branches = await branchService.findAll(req.tenantModels);
    apiResponse.success(res, branches);
  }),

  findById: asyncHandler(async (req, res) => {
    const branch = await branchService.findById(req.params.id, req.tenantModels);
    apiResponse.success(res, branch);
  }),

  update: asyncHandler(async (req, res) => {
    const branch = await branchService.update(req.params.id, req.body, req.tenantModels);
    apiResponse.success(res, branch, 'Branch updated');
  }),

  deactivate: asyncHandler(async (req, res) => {
    const branch = await branchService.deactivate(req.params.id, req.tenantModels);
    apiResponse.success(res, branch, 'Branch deactivated');
  }),
};

module.exports = branchController;