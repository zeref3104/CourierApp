const logger = require('../../logs/logger');
const emailService = require('../../services/notifications/email.service');
const { emailTemplates, interpolate } = require('../../services/notifications/emailTemplates');
const { sendPush } = require('../../services/notifications/push.service');
const socketHandler = require('./socketHandler');

// Settings cache for email-send reads. Mirrors PackageService._getSetting so
// the per-tenant `language` Setting is read once per TTL instead of per email.
// NOTE: this cache is SEPARATE from PackageService.settingsCache — setting
// changes must invalidate BOTH (SettingService calls invalidateSettingsCache).
const settingsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SUPPORTED_LANGUAGES = ['es', 'en', 'fr'];
// Deployment default when the Setting is missing or unreadable. Set
// DEFAULT_LANGUAGE=fr in the API env for French-first tenants. Any value
// outside the supported set falls back to 'es'.
const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES.includes(process.env.DEFAULT_LANGUAGE)
  ? process.env.DEFAULT_LANGUAGE
  : 'es';

async function getSetting(Setting, key, defaultValue) {
  // `Setting` here is the model returned by pkg.model('Setting') — the cache
  // key must read Setting.db.name directly (NOT Setting.Setting.db.name).
  const cacheKey = `${Setting.db.name}:${key}`;
  const cached = settingsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  const setting = await Setting.findOne({ key });
  const value = setting ? setting.value : defaultValue;

  settingsCache.set(cacheKey, { value, timestamp: Date.now() });
  return value;
}

/**
 * Invalidate this tenant's cached setting value(s). Called by
 * SettingService.update after a setting changes so emails and pushes pick up
 * the new value immediately instead of waiting out the TTL. Mirrors
 * PackageService.invalidateCache; both caches must be cleared.
 */
function invalidateSettingsCache(dbName, key) {
  const prefix = dbName ? `${dbName}:` : '';
  if (key) {
    settingsCache.delete(prefix + key);
  } else if (dbName) {
    for (const k of settingsCache.keys()) {
      if (k.startsWith(prefix)) settingsCache.delete(k);
    }
  } else {
    settingsCache.clear();
  }
}

/**
 * Resolve the tenant language for customer emails/pushes. Falls back to the
 * deployment default (DEFAULT_LANGUAGE env, 'es' unless overridden) when the
 * Setting model is unavailable on the package connection, the read fails, or
 * the stored value is not a supported language. Best-effort: never throws.
 */
async function getTenantLanguage(pkg) {
  try {
    const Setting = typeof pkg?.model === 'function' ? pkg.model('Setting') : null;
    if (!Setting) {
      logger.warn(`getTenantLanguage: Setting model unavailable; using default ${DEFAULT_LANGUAGE}`);
      return DEFAULT_LANGUAGE;
    }
    const lang = await getSetting(Setting, 'language', DEFAULT_LANGUAGE);
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
  } catch (err) {
    logger.warn(`getTenantLanguage: read failed (${String(err?.message || err)}); using default ${DEFAULT_LANGUAGE}`);
    return DEFAULT_LANGUAGE;
  }
}

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

/**
 * Per-language push notification templates (push-notifications spec + design
 * D12/D13). Mirrors emailTemplates.js: `title`/`body` are plain strings with
 * {{param}} placeholders interpolated by the shared `interpolate` helper; the
 * `statusLabels` sub-map keeps the push copy in sync with the email and in-app
 * labels. `es` is the fallback (tenant language is resolved by getTenantLanguage).
 */
const pushTemplates = {
  es: {
    statusLabels: {
      recibido_miami: 'recibido en Miami',
      almacen_miami: 'en almacén en Miami',
      en_transito: 'en tránsito hacia RD',
      llego_rd: 'ha llegado a RD',
      almacen_rd: 'en almacén en RD',
      disponible: 'listo para recoger',
      en_reparto: 'en reparto',
      entregado: 'entregado',
      cancelado: 'cancelado',
      extraviado: 'reportado como extraviado',
    },
    title: 'Tu paquete {{statusLabel}}',
    body: 'Paquete #{{tracking}}: {{statusLabel}}',
  },
  en: {
    statusLabels: {
      recibido_miami: 'received in Miami',
      almacen_miami: 'in our Miami warehouse',
      en_transito: 'in transit to the Dominican Republic',
      llego_rd: 'has arrived in the Dominican Republic',
      almacen_rd: 'in our DR warehouse',
      disponible: 'is ready for pickup',
      en_reparto: 'is out for delivery',
      entregado: 'has been delivered',
      cancelado: 'has been canceled',
      extraviado: 'has been reported as lost',
    },
    title: 'Your package {{statusLabel}}',
    body: 'Package #{{tracking}}: {{statusLabel}}',
  },
  fr: {
    statusLabels: {
      recibido_miami: 'reçu à Miami',
      almacen_miami: 'dans notre entrepôt à Miami',
      en_transito: 'en transit vers la République dominicaine',
      llego_rd: 'est arrivé en République dominicaine',
      almacen_rd: 'dans notre entrepôt en RD',
      disponible: 'est prêt à être récupéré',
      en_reparto: 'est en cours de livraison',
      entregado: 'a été livré',
      cancelado: 'a été annulé',
      extraviado: 'a été signalé comme perdu',
    },
    title: 'Colis {{statusLabel}}',
    body: 'Colis n°{{tracking}} : {{statusLabel}}',
  },
};

/**
 * Push a status-change notification to every registered device token of the
 * package's customer (push-notifications spec + design D12/D13). Best-effort:
 * no tokens -> no pill and no error; any Expo/send failure is logged and never
 * blocks the status-change flow. The payload stays well under the Expo 4 KB
 * data limit (only the small package metadata, never the full package doc).
 */
async function dispatchPush(pkg, toStatus, tenantSlug) {
  try {
    const user = await pkg.model('User').findOne({ clientId: pkg.customerId, isClient: true });
    if (!user || !Array.isArray(user.deviceTokens) || user.deviceTokens.length === 0) return;

    const lang = await getTenantLanguage(pkg);
    const template = pushTemplates[lang] || pushTemplates.es;
    const statusLabel = template.statusLabels[toStatus] || toStatus;
    const title = interpolate(template.title, { statusLabel });
    const body = interpolate(template.body, { tracking: pkg.tracking, statusLabel });

    const payload = {
      title,
      body,
      data: {
        type: 'package_status',
        packageId: pkg._id,
        trackingNumber: pkg.tracking,
        status: toStatus,
        companySlug: tenantSlug || '',
      },
    };

    const tokensList = user.deviceTokens.map((dt) => dt.token);
    const result = await sendPush(tokensList, payload);
    if (result.failed > 0) {
      logger.warn('Push dispatch partial failure: %d of %d failed', result.failed, result.sent + result.failed);
    }
  } catch (err) {
    // Best-effort (D13): a push outage must never fail the status-change flow.
    logger.error('Push dispatch error (best-effort): %s', err.message);
  }
}

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
      const { package: pkg, toStatus, userId, tenantSlug } = payload;

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
        const lang = await getTenantLanguage(pkg);
        const customerName = name || (emailTemplates[lang] || emailTemplates.es).fallbackCustomerName;
        await emailService.sendPackageStatusNotification(email, pkg.tracking, toStatus, customerName, lang);
      }

      // Notify customer (push) — best-effort, after in_app + email (design D13)
      await dispatchPush(pkg, toStatus, tenantSlug);
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
          const lang = await getTenantLanguage(pkg);
          const customerName = name || (emailTemplates[lang] || emailTemplates.es).fallbackCustomerName;
          await emailService.sendDeliveryNotification(email, pkg.tracking, delivery.receiverName, customerName, lang);
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

notificationHandler.invalidateSettingsCache = invalidateSettingsCache;
module.exports = notificationHandler;
