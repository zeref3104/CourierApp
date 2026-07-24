const logger = require('../../logs/logger');

const socketHandler = {
  onPackageStatusChanged: (payload) => {
    logger.debug('Socket: Package status changed', {
      tracking: payload.package?.tracking,
      status: payload.toStatus,
    });
  },

  onPaymentReceived: (payload) => {
    logger.debug('Socket: Payment received');
  },

  onDeliveryCompleted: (payload) => {
    logger.debug('Socket: Delivery completed');
  },

  onPackageCreated: (payload) => {
    logger.debug('Socket: Package created');
  },
};

module.exports = socketHandler;