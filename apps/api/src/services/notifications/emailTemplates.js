/**
 * Per-language email templates for customer notifications.
 *
 * Templates are plain strings with `{{param}}` placeholders, interpolated by
 * the exported `interpolate` helper. This keeps the email service free of any
 * templating dependency while matching the web UI's 3-language model (es is
 * the fallback).
 */

const statusLabels = {
  es: {
    disponible: 'listo para recoger',
    entregado: 'entregado',
    en_transito: 'en tránsito hacia República Dominicana',
    llego_rd: 'llegó a República Dominicana',
    cancelado: 'cancelado',
    almacen_rd: 'en almacén RD',
    almacen_miami: 'en almacén Miami',
    recibido_miami: 'recibido en Miami',
    en_reparto: 'en reparto',
  },
  en: {
    disponible: 'available for pickup',
    entregado: 'delivered',
    en_transito: 'in transit to the Dominican Republic',
    llego_rd: 'arrived in the Dominican Republic',
    cancelado: 'canceled',
    almacen_rd: 'in our DR warehouse',
    almacen_miami: 'in our Miami warehouse',
    recibido_miami: 'received in Miami',
    en_reparto: 'out for delivery',
  },
  fr: {
    disponible: 'prêt à être récupéré',
    entregado: 'livré',
    en_transito: 'en transit vers la République dominicaine',
    llego_rd: 'arrivé en République dominicaine',
    cancelado: 'annulé',
    almacen_rd: 'dans notre entrepôt en RD',
    almacen_miami: 'dans notre entrepôt à Miami',
    recibido_miami: 'reçu à Miami',
    en_reparto: 'en cours de livraison',
  },
};

const emailTemplates = {
  es: {
    fallbackCustomerName: 'Cliente',
    statusLabels: statusLabels.es,
    packageStatus: {
      subject: 'Actualización de tu envío #{{tracking}}',
      body: 'Hola {{customerName}},\n\nTu paquete #{{tracking}} está {{statusLabel}}.\n\nPuedes hacer seguimiento en tu panel de cliente.\n\nGracias por confiar en nosotros.',
    },
    deliveryCompleted: {
      subject: 'Tu paquete #{{tracking}} fue entregado',
      body: 'Hola {{customerName}},\n\nTu paquete #{{tracking}} fue entregado a {{receiverName}}.\n\nGracias por confiar en nosotros.',
    },
  },
  en: {
    fallbackCustomerName: 'Customer',
    statusLabels: statusLabels.en,
    packageStatus: {
      subject: 'Update on your shipment #{{tracking}}',
      body: 'Hello {{customerName}},\n\nYour package #{{tracking}} is {{statusLabel}}.\n\nYou can track it from your customer dashboard.\n\nThank you for trusting us.',
    },
    deliveryCompleted: {
      subject: 'Your package #{{tracking}} was delivered',
      body: 'Hello {{customerName}},\n\nYour package #{{tracking}} was delivered to {{receiverName}}.\n\nThank you for trusting us.',
    },
  },
  fr: {
    fallbackCustomerName: 'Client',
    statusLabels: statusLabels.fr,
    packageStatus: {
      subject: 'Mise à jour de votre envoi n°{{tracking}}',
      body: 'Bonjour {{customerName}},\n\nVotre colis n°{{tracking}} est {{statusLabel}}.\n\nVous pouvez suivre votre colis depuis votre tableau de bord client.\n\nMerci de nous faire confiance.',
    },
    deliveryCompleted: {
      subject: 'Votre colis n°{{tracking}} a été livré',
      body: 'Bonjour {{customerName}},\n\nVotre colis n°{{tracking}} a été livré à {{receiverName}}.\n\nMerci de nous faire confiance.',
    },
  },
};

/**
 * Replace `{{key}}` placeholders in a template with the matching params.
 * Unknown placeholders are left untouched.
 */
function interpolate(template, params) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? params[key] : match
  );
}

module.exports = { emailTemplates, interpolate };
