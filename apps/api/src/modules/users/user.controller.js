const userService = require('./user.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const userController = {
  create: asyncHandler(async (req, res) => {
    const user = await userService.create(req.body, req.tenantModels, req.tenant?.plan);
    apiResponse.created(res, user, 'User created');
  }),

  findAll: asyncHandler(async (req, res) => {
    const result = await userService.findAll(req.query, req.tenantModels);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  findById: asyncHandler(async (req, res) => {
    const user = await userService.findById(req.params.id, req.tenantModels);
    apiResponse.success(res, user, 'User found');
  }),

  update: asyncHandler(async (req, res) => {
    const user = await userService.update(req.params.id, req.body, req.tenantModels);
    apiResponse.success(res, user, 'User updated');
  }),

  deactivate: asyncHandler(async (req, res) => {
    await userService.deactivate(req.params.id, req.tenantModels);
    apiResponse.success(res, null, 'User deactivated');
  }),

  changePassword: asyncHandler(async (req, res) => {
    await userService.changePassword(
      req.user._id,
      req.body.currentPassword,
      req.body.newPassword,
      req.tenantModels
    );
    apiResponse.success(res, null, 'Password changed');
  }),
};

module.exports = userController;