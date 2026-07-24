import api from '../config/axios';
import type { ApiResponse, PaginationMeta } from '../types/api';

export const deliveryService = {
  findAll: (params?: Record<string, any>) =>
    api.get<ApiResponse<any[]> & { meta: PaginationMeta }>('/deliveries', { params }).then((r) => r.data),

  findById: (id: string) =>
    api.get<ApiResponse<any>>(`/deliveries/${id}`).then((r) => r.data),

  create: (data: Record<string, any>) =>
    api.post<ApiResponse<any>>('/deliveries', data).then((r) => r.data),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<any>>(`/deliveries/${id}/status`, { status }).then((r) => r.data),
};
