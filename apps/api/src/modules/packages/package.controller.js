const PackageService = require('./package.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const packageController = {
  create: asyncHandler(async (req, res) => {
    const service = new PackageService(req.tenantModels);
    const pkg = await service.create(req.body, req.user._id);
    apiResponse.created(res, pkg, 'Package created');
  }),

  findAll: asyncHandler(async (req, res) => {
    const service = new PackageService(req.tenantModels);
    const result = await service.findAll(req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  findByTracking: asyncHandler(async (req, res) => {
    const service = new PackageService(req.tenantModels);
    const pkg = await service.findByTracking(req.params.tracking);
    apiResponse.success(res, pkg);
  }),

  findById: asyncHandler(async (req, res) => {
    const service = new PackageService(req.tenantModels);
    const pkg = await service.findById(req.params.id);
    apiResponse.success(res, pkg);
  }),

  update: asyncHandler(async (req, res) => {
    const service = new PackageService(req.tenantModels);
    const pkg = await service.update(req.params.id, req.body);
    apiResponse.success(res, pkg, 'Package updated');
  }),

  changeStatus: asyncHandler(async (req, res) => {
    const service = new PackageService(req.tenantModels);
    const pkg = await service.changeStatus(
      req.params.id,
      req.body.status,
      req.user._id,
      req.body.notes
    );
    apiResponse.success(res, pkg, 'Status changed');
  }),

  getHistory: asyncHandler(async (req, res) => {
    const service = new PackageService(req.tenantModels);
    const history = await service.getHistory(req.params.id);
    apiResponse.success(res, history);
  }),

  uploadPhotos: asyncHandler(async (req, res) => {
    const service = new PackageService(req.tenantModels);
    const photos = await service.uploadPhotos(req.params.id, req.files);
    apiResponse.success(res, photos, 'Photos uploaded');
  }),
};

module.exports = packageController;