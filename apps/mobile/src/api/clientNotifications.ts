import { api } from '@/lib/api';
import { PaginationMeta } from '@/api/clientPanel';

/**
 * Typed wrappers for the client notification + device-token endpoints
 * (push-notifications spec, tasks 5.7):
 *   GET  /client/notifications   -> paginated in_app|push records for the client
 *   POST /client/device-token    -> register an Expo push token (dedup, cap 5)
 *
 * Responses use the API envelope `{ success, data, meta }`; each function
 * unwraps `data.data` (payload) / `data.meta` (pagination).
 */

export type NotificationType = 'package_status' | 'payment' | 'system' | 'delivery';

export interface ClientNotification {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead?: boolean;
  channel?: string;
  createdAt: string;
  sentAt?: string;
  [key: string]: unknown;
}

export interface DeviceTokenResult {
  registered: boolean;
  devices: number;
}

/** POST /client/device-token — idempotent per token (backend dedups + caps at 5). */
export async function registerDeviceToken(
  token: string,
  platform: 'android' | 'ios',
): Promise<DeviceTokenResult> {
  const { data } = await api.post<{ data: DeviceTokenResult }>('/client/device-token', { token, platform });
  return data.data;
}

export interface NotificationsQuery {
  page?: number;
  limit?: number;
}

export interface NotificationsPage {
  items: ClientNotification[];
  meta: PaginationMeta;
}

/** GET /client/notifications — the client's own in_app|push records, paginated. */
export async function fetchNotifications(query: NotificationsQuery = {}): Promise<NotificationsPage> {
  const { data } = await api.get<{ data: ClientNotification[]; meta: PaginationMeta }>('/client/notifications', {
    params: query,
  });
  return { items: data.data, meta: data.meta };
}
