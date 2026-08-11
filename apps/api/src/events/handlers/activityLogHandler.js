const logger = require('../../logs/logger');

const activityLogHandler = {
  async onPackageStatusChanged(payload) {
    try {
      const { package: pkg, fromStatus, toStatus, userId, notes } = payload;
      await pkg.model('ActivityLog').create({
        userId,
        action: `package.status_changed`,
        resource: 'Package',
        resourceId: pkg._id,
        details: { from: fromStatus, to: toStatus, notes },
      });
    } catch (err) {
      logger.error('ActivityLog handler error:', err);
    }
  },

  async onPaymentReceived(payload) {
    try {
      const { payment } = payload;
      await payment.model('ActivityLog').create({
        userId: payment.processedById,
        action: 'payment.received',
        resource: 'Payment',
        resourceId: payment._id,
        details: { amount: payment.amount, method: payment.method },
      });
    } catch (err) {
      logger.error('ActivityLog handler error:', err);
    }
  },

  async onDeliveryCompleted(payload) {
    try {
      const { delivery } = payload;
      await delivery.model('ActivityLog').create({
        userId: delivery.deliveredById,
        action: 'delivery.completed',
        resource: 'Delivery',
        resourceId: delivery._id,
        details: { type: delivery.type, receiver: delivery.receiverName },
      });
    } catch (err) {
      logger.error('ActivityLog handler error:', err);
    }
  },

  async onPackageCreated(payload) {
    try {
      const { package: pkg, userId } = payload;
      await pkg.model('ActivityLog').create({
        userId,
        action: 'package.created',
        resource: 'Package',
        resourceId: pkg._id,
        details: { tracking: pkg.tracking },
      });
    } catch (err) {
      logger.error('ActivityLog handler error:', err);
    }
  },

  async onCustomerCreated(payload) {
    try {
      const { customer } = payload;
      // No userId available from event, skip activity log
    } catch (err) {
      logger.error('ActivityLog handler error:', err);
    }
  },

  async onUserLogin(payload) {
    try {
      const { userId, models } = payload;
      // USER_LOGIN payloads carry only { User, Role } (auth.service) — resolve
      // the tenant ActivityLog through the User model's connection, matching
      // the other handlers (pkg.model / delivery.model patterns).
      if (models?.User) {
        await models.User.db.model('ActivityLog').create({
          userId,
          action: 'user.login',
          resource: 'User',
          resourceId: userId,
          details: { type: 'login' },
        });
      }
    } catch (err) {
      logger.error('ActivityLog handler error:', err);
    }
  },
};

module.exports = activityLogHandler;