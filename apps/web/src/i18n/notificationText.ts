import type { TFunction } from 'i18next';
import i18n from './index';

/**
 * Shape of a Notification row as returned by the API. `data` is a free-form
 * object whose fields depend on `type` (see apps/api notificationHandler.js).
 */
type NotificationRecord = {
  type?: string;
  title?: string;
  message?: string;
  data?: Record<string, unknown>;
};

/**
 * Format a payment amount as USD when it is a finite number; otherwise pass it
 * through untouched so legacy/string amounts still display.
 */
function formatAmount(amount: unknown): string {
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }
  return amount == null ? '' : String(amount);
}

/**
 * Render a notification's title/message through i18next using its
 * machine-readable `type` + `data`. Falls back to the raw persisted strings
 * for unknown types or incomplete `data` so legacy rows still display.
 *
 * NOTE — "package created" and "package status changed" notifications share
 * the same type (`package_status`) and the same `data` shape, so both are
 * rendered via the status label + tracking. The status label reuses the
 * existing `status.*` keys (same pattern as StatusBadge).
 */
export function getNotificationText(n: NotificationRecord, t: TFunction): { title: string; message: string } {
  const data = n.data;

  if (data && typeof data === 'object') {
    if (n.type === 'package_status' && typeof data.status === 'string' && typeof data.tracking === 'string') {
      return {
        title: t(`status.${data.status}`, { defaultValue: data.status }),
        message: t('notifications.packageStatusMessage', { tracking: data.tracking }),
      };
    }

    if (n.type === 'delivery' && typeof data.tracking === 'string') {
      return {
        title: t('notifications.deliveryCompletedTitle'),
        message: t('notifications.deliveryCompletedMessage', { tracking: data.tracking }),
      };
    }

    if (n.type === 'payment') {
      const receipt =
        (typeof data.receiptNumber === 'string' && data.receiptNumber) ||
        (typeof data.paymentId === 'string' ? String(data.paymentId).slice(-6) : '');
      if (receipt || typeof data.amount === 'number') {
        return {
          title: t('notifications.paymentReceivedTitle'),
          message: t('notifications.paymentReceivedMessage', { receipt, amount: formatAmount(data.amount) }),
        };
      }
    }
  }

  return { title: n.title ?? '', message: n.message ?? '' };
}
