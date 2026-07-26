const nodemailer = require('nodemailer');
const logger = require('../../logs/logger');

/**
 * Email notification service.
 * Uses nodemailer with configurable transport (SMTP by default).
 * Falls back to console logging if no SMTP credentials are configured.
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.from = process.env.SMTP_FROM || 'noreply@courier.app';
  }

  /**
   * Lazy-initialize the transporter on first send.
   */
  _getTransporter() {
    if (this.transporter) return this.transporter;

    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      logger.info('Email service: SMTP transport configured');
    } else {
      // Fallback: log emails instead of sending (useful in development)
      this.transporter = {
        sendMail: async (mailOptions) => {
          logger.info('[EMAIL LOG] To: %s | Subject: %s', mailOptions.to, mailOptions.subject);
          return { messageId: `logged-${Date.now()}` };
        },
      };
      logger.warn('Email service: No SMTP_HOST configured, emails will be logged to console');
    }

    return this.transporter;
  }

  /**
   * Send a notification email.
   */
  async sendNotification({ to, subject, text, html }) {
    if (!to) {
      logger.warn('Email service: skip send — no recipient');
      return;
    }

    try {
      const transporter = this._getTransporter();
      const info = await transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html: html || text,
      });
      logger.debug('Email sent: %s', info.messageId);
      return info;
    } catch (err) {
      logger.error('Email send failed: %s', err.message);
      // Don't throw — email failures should not break the request
    }
  }

  /**
   * Send package status update notification.
   */
  async sendPackageStatusNotification(email, tracking, status, customerName) {
    const statusLabels = {
      disponible: 'listo para recoger',
      entregado: 'entregado',
      en_transito: 'en tránsito hacia República Dominicana',
      llego_rd: 'llegó a República Dominicana',
      cancelado: 'cancelado',
      almacen_rd: 'en almacén RD',
      almacen_miami: 'en almacén Miami',
      recibido_miami: 'recibido en Miami',
      en_reparto: 'en reparto',
    };

    const label = statusLabels[status] || status;
    const subject = `Actualización de tu envío #${tracking}`;
    const text = `Hola ${customerName},\n\nTu paquete #${tracking} está ${label}.\n\nPuedes hacer seguimiento en tu panel de cliente.\n\nGracias por confiar en nosotros.`;

    return this.sendNotification({ to: email, subject, text });
  }

  /**
   * Send delivery completion notification.
   */
  async sendDeliveryNotification(email, tracking, receiverName, customerName) {
    const subject = `Tu paquete #${tracking} fue entregado`;
    const text = `Hola ${customerName},\n\nTu paquete #${tracking} fue entregado a ${receiverName}.\n\nGracias por confiar en nosotros.`;

    return this.sendNotification({ to: email, subject, text });
  }
}

// Export singleton
module.exports = new EmailService();
