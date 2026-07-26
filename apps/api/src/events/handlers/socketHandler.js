const logger = require('../../logs/logger');
const socketState = require('../../services/socketState');

function getIO() {
  const io = socketState.getIO();
  if (!io) {
    logger.warn('Socket.io not initialized yet, skipping real-time event');
  }
  return io;
}

const socketHandler = {
  onPackageStatusChanged: (payload) => {
    const io = getIO();
    if (!io) return;

    const { package: pkg, fromStatus, toStatus, userId } = payload;
    logger.debug('Socket: Emitting package:status_changed', {
      tracking: pkg?.tracking,
      status: toStatus,
    });

    // Emit to tenant room
    io.to(`tenant:${pkg?.tenant || ''}`).emit('package:status_changed', {
      packageId: pkg?._id,
      tracking: pkg?.tracking,
      status: toStatus,
      fromStatus,
      timestamp: new Date(),
    });

    // Emit to the customer's user room if they're connected
    if (pkg?.customerId) {
      io.to(`customer:${pkg.customerId}`).emit('package:status_changed', {
        packageId: pkg._id,
        tracking: pkg.tracking,
        status: toStatus,
        timestamp: new Date(),
      });
    }
  },

  onPaymentReceived: (payload) => {
    const io = getIO();
    if (!io) return;

    const { payment, package: pkg } = payload;
    logger.debug('Socket: Emitting payment:received');

    io.to(`tenant:${payment?.tenant || ''}`).emit('payment:received', {
      paymentId: payment?._id,
      packageIds: payment?.packages,
      packageId: payment?.packages?.[0],
      amount: payment?.amount,
      method: payment?.method,
      timestamp: new Date(),
    });

    if (pkg?.customerId) {
      io.to(`customer:${pkg.customerId}`).emit('payment:received', {
        paymentId: payment?._id,
        packageIds: payment?.packages,
        packageId: payment?.packages?.[0],
        amount: payment?.amount,
        timestamp: new Date(),
      });
    }
  },

  onDeliveryCompleted: (payload) => {
    const io = getIO();
    if (!io) return;

    const { delivery, package: pkg } = payload;
    logger.debug('Socket: Emitting delivery:completed');

    io.to(`tenant:${delivery?.tenant || ''}`).emit('delivery:completed', {
      deliveryId: delivery?._id,
      packageId: delivery?.packageId,
      type: delivery?.type,
      timestamp: new Date(),
    });

    if (pkg?.customerId) {
      io.to(`customer:${pkg.customerId}`).emit('delivery:completed', {
        deliveryId: delivery?._id,
        packageId: delivery?.packageId,
        tracking: pkg.tracking,
        timestamp: new Date(),
      });
    }
  },

  onPackageCreated: (payload) => {
    const io = getIO();
    if (!io) return;

    const { package: pkg } = payload;
    logger.debug('Socket: Emitting package:created', {
      tracking: pkg?.tracking,
    });

    io.to(`tenant:${pkg?.tenant || ''}`).emit('package:created', {
      packageId: pkg?._id,
      tracking: pkg?.tracking,
      status: pkg?.status,
      timestamp: new Date(),
    });
  },
};

module.exports = socketHandler;
