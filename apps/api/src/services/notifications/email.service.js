const nodemailer = require('nodemailer');
const logger = require('../../logs/logger');
const { emailTemplates, interpolate } = require('./emailTemplates');

// Deployment default language when no explicit lang is passed. Set
// DEFAULT_LANGUAGE=fr in the API env for French-first tenants.
const DEFAULT_LANGUAGE = process.env.DEFAULT_LANGUAGE || 'es';

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
  async sendPackageStatusNotification(email, tracking, status, customerName, lang = DEFAULT_LANGUAGE) {
    const templates = emailTemplates[lang] || emailTemplates.es;
    const label = templates.statusLabels[status] || status;

    const subject = interpolate(templates.packageStatus.subject, { tracking });
    const text = interpolate(templates.packageStatus.body, {
      tracking,
      customerName,
      statusLabel: label,
    });

    return this.sendNotification({ to: email, subject, text });
  }

  /**
   * Send a registration OTP verification code.
   * Template is per-language (es/en/fr, es default per design D6).
   */
  async sendOtpCode(email, code, lang = DEFAULT_LANGUAGE) {
    const templates = emailTemplates[lang] || emailTemplates.es;

    const subject = templates.otp.subject;
    const text = interpolate(templates.otp.body, { code });

    return this.sendNotification({ to: email, subject, text });
  }

  /**
   * Send delivery completion notification.
   */
  async sendDeliveryNotification(email, tracking, receiverName, customerName, lang = DEFAULT_LANGUAGE) {
    const templates = emailTemplates[lang] || emailTemplates.es;

    const subject = interpolate(templates.deliveryCompleted.subject, { tracking });
    const text = interpolate(templates.deliveryCompleted.body, {
      tracking,
      receiverName,
      customerName,
    });

    return this.sendNotification({ to: email, subject, text });
  }
}

// Export singleton
module.exports = new EmailService();
