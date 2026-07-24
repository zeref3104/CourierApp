const NotificationService = require('./notification.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const notificationController = {
  findAll: asyncHandler(async (req, res) => {
    const service = new NotificationService(req.tenantModels);
    const result = await service.findAll(req.user._id, req.query);
    apiResponse.paginated(res, result.data, result.meta);
  }),

  markAsRead: asyncHandler(async (req, res) => {
    const service = new NotificationService(req.tenantModels);
    const notification = await service.markAsRead(req.params.id, req.user._id);
    apiResponse.success(res, notification, 'Marked as read');
  }),

  markAllAsRead: asyncHandler(async (req, res) => {
    const service = new NotificationService(req.tenantModels);
    await service.markAllAsRead(req.user._id);
    apiResponse.success(res, null, 'All marked as read');
  }),

  getUnreadCount: asyncHandler(async (req, res) => {
    const service = new NotificationService(req.tenantModels);
    const result = await service.getUnreadCount(req.user._id);
    apiResponse.success(res, result);
  }),
};

module.exports = notificationController;