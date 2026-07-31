import api from '../config/axios';
import type { ApiResponse, PaginationMeta } from '../types/api';

export const deliveryService = {
  findAll: (params?: Record<string, any>) =>
    api.get<ApiResponse<any[]> & { meta: PaginationMeta }>('/deliveries', { params }).then((r) => r.data),

  create: (data: Record<string, any>) =>
    api.post<ApiResponse<any>>('/deliveries', data).then((r) => r.data),

  complete: (id: string, data?: Record<string, any>) =>
    api.patch<ApiResponse<any>>(`/deliveries/${id}/complete`, data).then((r) => r.data),
};
