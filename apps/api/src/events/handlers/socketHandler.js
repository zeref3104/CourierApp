const logger = require('../../logs/logger');
const socketState = require('../../services/socketState');

function getIO() {
  const io = socketState.getIO();
  if (!io) {
    logger.warn('Socket.io not initialized yet, skipping real-time event');
  }
  return io;
}

function tenantRoom(slug) {
  return slug ? `tenant:${slug}` : null;
}

const socketHandler = {
  onPackageStatusChanged: (payload) => {
    const io = getIO();
    if (!io) return;

    const { package: pkg, fromStatus, toStatus, tenantSlug } = payload;
    logger.debug('Socket: Emitting package:status_changed', {
      tracking: pkg?.tracking,
      status: toStatus,
      tenant: tenantSlug,
    });

    // Emit to tenant room (all staff of the tenant)
    const room = tenantRoom(tenantSlug);
    if (room) {
      io.to(room).emit('package:status_changed', {
        packageId: pkg?._id,
        tracking: pkg?.tracking,
        status: toStatus,
        fromStatus,
        timestamp: new Date(),
      });
    }

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

    const { payment, packages, tenantSlug } = payload;
    logger.debug('Socket: Emitting payment:received', {
      tenant: tenantSlug,
    });

    const room = tenantRoom(tenantSlug);
    if (room) {
      io.to(room).emit('payment:received', {
        paymentId: payment?._id,
        packageIds: payment?.packages,
        packageId: payment?.packages?.[0],
        amount: payment?.amount,
        method: payment?.method,
        timestamp: new Date(),
      });
    }

    // Emit to each affected customer's room (deduped — a payment can span
    // several packages belonging to the same customer).
    const seenCustomers = new Set();
    (Array.isArray(packages) ? packages : []).forEach((pkg) => {
      const customerId = pkg?.customerId;
      if (customerId && !seenCustomers.has(String(customerId))) {
        seenCustomers.add(String(customerId));
        io.to(`customer:${customerId}`).emit('payment:received', {
          paymentId: payment?._id,
          packageIds: payment?.packages,
          packageId: payment?.packages?.[0],
          amount: payment?.amount,
          timestamp: new Date(),
        });
      }
    });
  },

  onDeliveryCompleted: (payload) => {
    const io = getIO();
    if (!io) return;

    const { delivery, package: pkg, tenantSlug } = payload;
    logger.debug('Socket: Emitting delivery:completed', {
      tenant: tenantSlug,
    });

    const room = tenantRoom(tenantSlug);
    if (room) {
      io.to(room).emit('delivery:completed', {
        deliveryId: delivery?._id,
        packageId: delivery?.packageId,
        type: delivery?.type,
        timestamp: new Date(),
      });
    }

    // The package may be missing on some call sites — skip the customer
    // emit rather than throwing.
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

    const { package: pkg, tenantSlug } = payload;
    logger.debug('Socket: Emitting package:created', {
      tracking: pkg?.tracking,
      tenant: tenantSlug,
    });

    const room = tenantRoom(tenantSlug);
    if (room) {
      io.to(room).emit('package:created', {
        packageId: pkg?._id,
        tracking: pkg?.tracking,
        status: pkg?.status,
        timestamp: new Date(),
      });
    }
  },

  onNotificationCreated: (payload) => {
    const io = getIO();
    if (!io) return;

    const { notification } = payload;
    if (!notification) return;

    const event = {
      notificationId: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.createdAt || notification.sentAt || new Date(),
    };

    logger.debug('Socket: Emitting notification:new', {
      type: notification.type,
      userId: notification.userId,
      customerId: notification.customerId,
    });

    // Staff notification → that user's room
    if (notification.userId) {
      io.to(`user:${notification.userId}`).emit('notification:new', event);
    }

    // Client notification → the customer's room
    if (notification.customerId) {
      io.to(`customer:${notification.customerId}`).emit('notification:new', event);
    }
  },
};

module.exports = socketHandler;
