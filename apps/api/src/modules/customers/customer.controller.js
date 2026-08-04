const CustomerService = require('./customer.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const customerController = {
  /**
   * CustomerService needs the master context to mint global client codes
   * ({PREFIX}-{SEQ}) via the master CompanyCounter (design D7).
   */
  _buildService(req) {
    return new CustomerService(req.tenantModels, {
      masterConnection: req.app.locals.masterConnection,
      companyId: req.tenant?.id,
      clientCodePrefix: req.tenant?.clientCodePrefix,
    });
  },

  create: asyncHandler(async (req, res) => {
    const service = customerController._buildService(req);
    const customer = await service.create(req.body, req.user.branchId);
    apiResponse.created(res, customer, 'Customer created');
  }),

  findAll: asyncHandler(async (req, res) => {
    const service = new CustomerService(req.tenantModels);
    const result = await service.findAll(req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  findById: asyncHandler(async (req, res) => {
    const service = new CustomerService(req.tenantModels);
    const customer = await service.findById(req.params.id);
    apiResponse.success(res, customer);
  }),

  update: asyncHandler(async (req, res) => {
    const service = new CustomerService(req.tenantModels);
    const customer = await service.update(req.params.id, req.body, req.user.branchId);
    apiResponse.success(res, customer, 'Customer updated');
  }),

  deactivate: asyncHandler(async (req, res) => {
    const service = new CustomerService(req.tenantModels);
    await service.deactivate(req.params.id);
    apiResponse.success(res, null, 'Customer deactivated');
  }),

  getPackages: asyncHandler(async (req, res) => {
    const service = new CustomerService(req.tenantModels);
    const result = await service.getPackages(req.params.id, req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  getPayments: asyncHandler(async (req, res) => {
    const service = new CustomerService(req.tenantModels);
    const result = await service.getPayments(req.params.id, req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),
};

module.exports = customerController;