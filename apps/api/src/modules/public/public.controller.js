const publicService = require('./public.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const publicController = {
  /** GET /public/companies -> [{ id, slug, name }] of active, licensed companies */
  listCompanies: asyncHandler(async (req, res) => {
    const companies = await publicService.listCompanies(req.app.locals.masterConnection);
    apiResponse.success(res, companies);
  }),

  /** GET /public/companies/:companyId/branches -> [{ id, name, address }] */
  listBranches: asyncHandler(async (req, res) => {
    const branches = await publicService.listBranches(
      req.app.locals.masterConnection,
      req.params.companyId
    );
    apiResponse.success(res, branches);
  }),
};

module.exports = publicController;
