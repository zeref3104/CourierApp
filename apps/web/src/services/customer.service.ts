import api from '../config/axios';
import type { ApiResponse, PaginationMeta } from '../types/api';

export const customerService = {
  findAll: (params?: Record<string, any>) =>
    api.get<ApiResponse<any[]> & { meta: PaginationMeta }>('/customers', { params }).then((r) => r.data),

  create: (data: Record<string, any>) =>
    api.post<ApiResponse<any>>('/customers', data).then((r) => r.data),

  findById: (id: string) =>
    api.get<ApiResponse<any>>(`/customers/${id}`).then((r) => r.data),

  update: (id: string, data: Record<string, any>) =>
    api.patch<ApiResponse<any>>(`/customers/${id}`, data).then((r) => r.data),

  deactivate: (id: string) =>
    api.delete(`/customers/${id}`).then((r) => r.data),

  getPackages: (id: string, params?: Record<string, any>) =>
    api.get(`/customers/${id}/packages`, { params }).then((r) => r.data),

  getPayments: (id: string, params?: Record<string, any>) =>
    api.get(`/customers/${id}/payments`, { params }).then((r) => r.data),
};