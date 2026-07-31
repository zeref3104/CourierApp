const logger = require('../../logs/logger');
const emailService = require('../../services/notifications/email.service');
const socketHandler = require('./socketHandler');

/**
 * Look up customer email from the pkg model connection.
 * Falls back gracefully if customer is not found.
 */
async function getCustomerEmail(pkg) {
  try {
    const customer = await pkg.model('Customer').findById(pkg.customerId).select('email name lastName');
    if (customer) {
      return { email: customer.email, name: `${customer.name} ${customer.lastName}` };
    }
  } catch {
    // Ignore lookup failures — email is best-effort
  }
  return {};
}

/**
 * Create a Notification doc and push a notification:new socket event to the
 * right room (user:{userId} for staff, customer:{customerId} for clients).
 * Never throws — socket emission is best-effort.
 */
async function createNotification(doc, data) {
  const notification = await doc.model('Notification').create(data);
  try {
    socketHandler.onNotificationCreated({ notification });
  } catch (err) {
    logger.error('Failed to emit notification:new:', err);
  }
  return notification;
}

const statusLabels = {
  recibido_miami: 'Tu paquete fue recibido en Miami',
  almacen_miami: 'Tu paquete está en almacén en Miami',
  en_transito: 'Tu paquete está en tránsito hacia RD',
  llego_rd: 'Tu paquete ha llegado a RD',
  almacen_rd: 'Tu paquete está en almacén en RD',
  disponible: 'Tu paquete está listo para recoger',
  en_reparto: 'Tu paquete está en reparto',
  entregado: 'Tu paquete ha sido entregado',
  cancelado: 'Tu paquete ha sido cancelado',
  extraviado: 'Tu paquete se reportó como extraviado',
};

const notificationHandler = {
  async onPackageCreated(payload) {
    try {
      const { package: pkg, userId } = payload;

      // Package creation notifies STAFF only — customers should not get an
      // email for every package they order (spam). Status changes that matter
      // to the customer (PACKAGE_STATUS_CHANGED) are handled separately.
      if (userId) {
        await createNotification(pkg, {
          userId,
          type: 'package_status',
          title: 'Paquete registrado',
          message: `Paquete #${pkg.tracking} registrado`,
          data: { packageId: pkg._id, tracking: pkg.tracking, status: pkg.status },
          channel: 'in_app',
        });
      }
    } catch (err) {
      logger.error('Notification handler error:', err);
    }
  },

  async onPackageStatusChanged(payload) {
    try {
      const { package: pkg, toStatus, userId } = payload;

      const title = statusLabels[toStatus] || `Estado actualizado: ${toStatus}`;

      // Notify customer (in-app + socket)
      await createNotification(pkg, {
        customerId: pkg.customerId,
        type: 'package_status',
        title,
        message: `Tracking #${pkg.tracking}: ${title}`,
        data: { packageId: pkg._id, tracking: pkg.tracking, status: toStatus },
        channel: 'in_app',
      });

      // Notify the acting staff member (in-app + socket)
      if (userId) {
        await createNotification(pkg, {
          userId,
          type: 'package_status',
          title: 'Estado de paquete actualizado',
          message: `Paquete #${pkg.tracking}: ${title}`,
          data: { packageId: pkg._id, tracking: pkg.tracking, status: toStatus },
          channel: 'in_app',
        });
      }

      // Notify customer (email) — best-effort
      const { email, name } = await getCustomerEmail(pkg);
      if (email) {
        await emailService.sendPackageStatusNotification(email, pkg.tracking, toStatus, name || 'Cliente');
      }
    } catch (err) {
      logger.error('Notification handler error:', err);
    }
  },

  async onDeliveryCompleted(payload) {
    try {
      const { delivery, package: pkg, userId } = payload;
      if (pkg) {
        // Notify customer (in-app + socket)
        await createNotification(pkg, {
          customerId: pkg.customerId,
          type: 'delivery',
          title: 'Entrega completada',
          message: `Tu paquete #${pkg.tracking} fue entregado a ${delivery.receiverName}`,
          data: { packageId: pkg._id, tracking: pkg.tracking, deliveryId: delivery._id },
          channel: 'in_app',
        });

        // Notify the acting staff member (in-app + socket)
        if (userId) {
          await createNotification(pkg, {
            userId,
            type: 'delivery',
            title: 'Entrega completada',
            message: `Paquete #${pkg.tracking} entregado a ${delivery.receiverName}`,
            data: { packageId: pkg._id, tracking: pkg.tracking, deliveryId: delivery._id },
            channel: 'in_app',
          });
        }

        // Notify customer (email) — best-effort
        const { email, name } = await getCustomerEmail(pkg);
        if (email) {
          await emailService.sendDeliveryNotification(email, pkg.tracking, delivery.receiverName, name || 'Cliente');
        }
      }
    } catch (err) {
      logger.error('Notification handler error:', err);
    }
  },

  async onPaymentReceived(payload) {
    try {
      const { payment } = payload;
      if (payment?.processedById) {
        await createNotification(payment, {
          userId: payment.processedById,
          type: 'payment',
          title: 'Pago registrado',
          message: `Recibo ${payment.receiptNumber || String(payment._id).slice(-6)} por ${payment.amount}`,
          data: {
            paymentId: payment._id,
            receiptNumber: payment.receiptNumber,
            amount: payment.amount,
            method: payment.method,
          },
          channel: 'in_app',
        });
      }
    } catch (err) {
      logger.error('Notification handler error:', err);
    }
  },
};

module.exports = notificationHandler;
