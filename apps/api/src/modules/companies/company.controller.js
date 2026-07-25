const companyService = require('./company.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const companyController = {
  create: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const company = await companyService.create(req.body, masterConnection);
    apiResponse.created(res, company, 'Company created successfully');
  }),

  findAll: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const result = await companyService.findAll(req.query, masterConnection);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  findById: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const result = await companyService.findById(req.params.id, masterConnection);
    apiResponse.success(res, result);
  }),

  update: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const company = await companyService.update(req.params.id, req.body, masterConnection);
    apiResponse.success(res, company, 'Company updated');
  }),

  delete: asyncHandler(async (req, res) => {
    const masterConnection = req.app.locals.masterConnection;
    const result = await companyService.delete(req.params.id, masterConnection);
    apiResponse.success(res, result, 'Company deleted permanently');
  }),
};

module.exports = companyController;