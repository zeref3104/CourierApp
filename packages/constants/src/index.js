/**
 * Shared constants for Courier SaaS Platform.
 * Extracted from apps/api/src/models/tenant/index.js and other sources.
 */

const PACKAGE_STATUSES = {
  RECIBIDO_MIAMI: 'recibido_miami',
  ALMACEN_MIAMI: 'almacen_miami',
  EN_TRANSITO: 'en_transito',
  LLEGO_RD: 'llego_rd',
  ALMACEN_RD: 'almacen_rd',
  DISPONIBLE: 'disponible',
  EN_REPARTO: 'en_reparto',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado',
  EXTRAVIADO: 'extraviado',
};

const PACKAGE_STATUS_LIST = Object.values(PACKAGE_STATUSES);

const STATUS_TRANSITIONS = {
  [PACKAGE_STATUSES.RECIBIDO_MIAMI]: [PACKAGE_STATUSES.ALMACEN_MIAMI],
  [PACKAGE_STATUSES.ALMACEN_MIAMI]: [PACKAGE_STATUSES.EN_TRANSITO],
  [PACKAGE_STATUSES.EN_TRANSITO]: [PACKAGE_STATUSES.LLEGO_RD],
  [PACKAGE_STATUSES.LLEGO_RD]: [PACKAGE_STATUSES.ALMACEN_RD],
  [PACKAGE_STATUSES.ALMACEN_RD]: [PACKAGE_STATUSES.DISPONIBLE, PACKAGE_STATUSES.CANCELADO, PACKAGE_STATUSES.EXTRAVIADO],
  [PACKAGE_STATUSES.DISPONIBLE]: [PACKAGE_STATUSES.EN_REPARTO, PACKAGE_STATUSES.ENTREGADO, PACKAGE_STATUSES.CANCELADO],
  [PACKAGE_STATUSES.EN_REPARTO]: [PACKAGE_STATUSES.ENTREGADO, PACKAGE_STATUSES.DISPONIBLE],
  [PACKAGE_STATUSES.ENTREGADO]: [],
  [PACKAGE_STATUSES.CANCELADO]: [],
  [PACKAGE_STATUSES.EXTRAVIADO]: [],
};

const STATUS_LABELS = {
  [PACKAGE_STATUSES.RECIBIDO_MIAMI]: 'Recibido Miami',
  [PACKAGE_STATUSES.ALMACEN_MIAMI]: 'Almacén Miami',
  [PACKAGE_STATUSES.EN_TRANSITO]: 'En Tránsito',
  [PACKAGE_STATUSES.LLEGO_RD]: 'Llegó a RD',
  [PACKAGE_STATUSES.ALMACEN_RD]: 'Almacén RD',
  [PACKAGE_STATUSES.DISPONIBLE]: 'Disponible',
  [PACKAGE_STATUSES.EN_REPARTO]: 'En Reparto',
  [PACKAGE_STATUSES.ENTREGADO]: 'Entregado',
  [PACKAGE_STATUSES.CANCELADO]: 'Cancelado',
  [PACKAGE_STATUSES.EXTRAVIADO]: 'Extraviado',
};

const PAYMENT_METHODS = ['cash', 'card', 'transfer'];
const PAYMENT_STATUSES = ['pending', 'paid', 'refunded'];

const DELIVERY_TYPES = ['branch', 'home'];
const NOTIFICATION_CHANNELS = ['in_app', 'email', 'whatsapp', 'push'];
const NOTIFICATION_TYPES = ['package_status', 'payment', 'system', 'delivery'];

const LICENSE_STATUSES = ['active', 'expired', 'cancelled', 'trial'];

/**
 * Global client identity code (client-code-identity spec):
 * - Prefix: platform-unique, admin-configured, 2-5 uppercase letters (e.g. "CS").
 * - Full code: `{PREFIX}-{SEQ}` with a zero-padded 6-digit sequence (e.g. "CS-000001").
 * Values are regex source strings (no delimiters) so callers can build RegExp freely.
 */
const CLIENT_CODE_PREFIX_PATTERN = '^[A-Z]{2,5}$';
const CLIENT_CODE_PATTERN = '^[A-Z]{2,5}-\\d{6}$';

/**
 * Push/device-token contract (push-notifications spec, design D11).
 * - DEVICE_PLATFORMS: platforms the mobile app reports for a device token
 *   (the Expo push token belongs to one physical device on one OS).
 * - PUSH_TOKEN_PATTERN: Expo push service token format `ExponentPushToken[...]`
 *   with a base64url-safe payload (`[A-Za-z0-9_-]`). Regex source string (no
 *   delimiters) so callers build RegExp freely, matching the code patterns.
 */
const DEVICE_PLATFORMS = ['android', 'ios'];
const PUSH_TOKEN_PATTERN = '^ExponentPushToken\\[[A-Za-z0-9_-]+\\]$';

const TERMINAL_STATUSES = [PACKAGE_STATUSES.ENTREGADO, PACKAGE_STATUSES.CANCELADO, PACKAGE_STATUSES.EXTRAVIADO];
const ACTIVE_STATUSES = [
  PACKAGE_STATUSES.RECIBIDO_MIAMI,
  PACKAGE_STATUSES.ALMACEN_MIAMI,
  PACKAGE_STATUSES.EN_TRANSITO,
  PACKAGE_STATUSES.LLEGO_RD,
  PACKAGE_STATUSES.ALMACEN_RD,
  PACKAGE_STATUSES.DISPONIBLE,
  PACKAGE_STATUSES.EN_REPARTO,
];

module.exports = {
  PACKAGE_STATUSES,
  PACKAGE_STATUS_LIST,
  STATUS_TRANSITIONS,
  STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  DELIVERY_TYPES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  LICENSE_STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  CLIENT_CODE_PREFIX_PATTERN,
  CLIENT_CODE_PATTERN,
  DEVICE_PLATFORMS,
  PUSH_TOKEN_PATTERN,
};
