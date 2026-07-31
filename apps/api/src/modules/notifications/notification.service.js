const BaseRepository = require('../../repositories/base/base.repository');
const NotFoundException = require('../../exceptions/NotFoundException');

class NotificationService {
  constructor(models) {
    this.models = models;
    this.repository = new BaseRepository(models.Notification);
  }

  async findAll(userId, query = {}) {
    const { page = 1, limit = 20, isRead, type } = query;
    const filter = { userId };

    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (type) filter.type = type;

    return this.repository.findAll(filter, {
      page: Number(page),
      limit: Number(limit),
      sort: { createdAt: -1 },
    });
  }

  async markAsRead(id, userId) {
    const notification = await this.models.Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) throw new NotFoundException('Notification');
    return notification;
  }

  async markAllAsRead(userId) {
    await this.models.Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return { success: true };
  }

  async getUnreadCount(userId) {
    const count = await this.repository.count({ userId, isRead: false });
    return { count };
  }
}

module.exports = NotificationService;