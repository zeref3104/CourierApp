const roleService = require('./role.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const roleController = {
  create: asyncHandler(async (req, res) => {
    const role = await roleService.create(req.body, req.tenantModels);
    apiResponse.created(res, role, 'Role created');
  }),

  findAll: asyncHandler(async (req, res) => {
    const roles = await roleService.findAll(req.tenantModels);
    apiResponse.success(res, roles);
  }),

  update: asyncHandler(async (req, res) => {
    const role = await roleService.update(req.params.id, req.body, req.tenantModels);
    apiResponse.success(res, role, 'Role updated');
  }),

  delete: asyncHandler(async (req, res) => {
    await roleService.delete(req.params.id, req.tenantModels);
    apiResponse.success(res, null, 'Role deleted');
  }),
};

module.exports = roleController;