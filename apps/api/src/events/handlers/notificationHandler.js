const logger = require('../../logs/logger');

const notificationHandler = {
  async onPackageStatusChanged(payload) {
    try {
      const { package: pkg, toStatus } = payload;

      const statusLabels = {
        disponible: 'Tu paquete está listo para recoger',
        entregado: 'Tu paquete ha sido entregado',
        en_transito: 'Tu paquete está en tránsito hacia RD',
        llego_rd: 'Tu paquete ha llegado a RD',
        cancelado: 'Tu paquete ha sido cancelado',
      };

      const title = statusLabels[toStatus] || `Estado actualizado: ${toStatus}`;

      // Notify customer
      await pkg.model('Notification').create({
        customerId: pkg.customerId,
        type: 'package_status',
        title,
        message: `Tracking #${pkg.tracking}: ${title}`,
        data: { packageId: pkg._id, tracking: pkg.tracking, status: toStatus },
        channel: 'in_app',
      });
    } catch (err) {
      logger.error('Notification handler error:', err);
    }
  },

  async onDeliveryCompleted(payload) {
    try {
      const { delivery, package: pkg } = payload;
      if (pkg) {
        await pkg.model('Notification').create({
          customerId: pkg.customerId,
          type: 'delivery',
          title: 'Entrega completada',
          message: `Tu paquete #${pkg.tracking} fue entregado a ${delivery.receiverName}`,
          data: { packageId: pkg._id, tracking: pkg.tracking, deliveryId: delivery._id },
          channel: 'in_app',
        });
      }
    } catch (err) {
      logger.error('Notification handler error:', err);
    }
  },
};

module.exports = notificationHandler;