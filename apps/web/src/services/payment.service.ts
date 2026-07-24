import api from '../config/axios';
import type { ApiResponse, PaginationMeta } from '../types/api';

export const paymentService = {
  findAll: (params?: Record<string, any>) =>
    api.get<ApiResponse<any[]> & { meta: PaginationMeta }>('/payments', { params }).then((r) => r.data),

  create: (data: Record<string, any>) =>
    api.post<ApiResponse<any>>('/payments', data).then((r) => r.data),

  findById: (id: string) =>
    api.get<ApiResponse<any>>(`/payments/${id}`).then((r) => r.data),

  getDailySummary: (date?: string) =>
    api.get<ApiResponse<any>>('/payments/summary/daily', { params: { date } }).then((r) => r.data),
};