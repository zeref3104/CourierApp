const companyService = require('./company.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const companyController = {
  create: asyncHandler(async (req, res) => {
    const company = await companyService.create(req.body);
    apiResponse.created(res, company, 'Company created successfully');
  }),

  findAll: asyncHandler(async (req, res) => {
    const result = await companyService.findAll(req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  findById: asyncHandler(async (req, res) => {
    const result = await companyService.findById(req.params.id);
    apiResponse.success(res, result);
  }),

  update: asyncHandler(async (req, res) => {
    const company = await companyService.update(req.params.id, req.body);
    apiResponse.success(res, company, 'Company updated');
  }),

  deactivate: asyncHandler(async (req, res) => {
    const company = await companyService.deactivate(req.params.id);
    apiResponse.success(res, company, 'Company deactivated');
  }),
};

module.exports = companyController;