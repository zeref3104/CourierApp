import api from '../config/axios';
import type { ApiResponse, PaginationMeta } from '../types/api';

export const notificationService = {
  findAll: (params?: Record<string, any>) =>
    api
      .get<ApiResponse<any[]> & { meta: PaginationMeta }>('/notifications', { params })
      .then((r) => r.data),

  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/notifications/unread-count').then((r) => r.data),

  markAsRead: (id: string) =>
    api.patch<ApiResponse<any>>(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    api.patch<ApiResponse<any>>('/notifications/read-all').then((r) => r.data),
};
