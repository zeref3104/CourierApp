import api from '../config/axios';
import type { ApiResponse, PaginationMeta } from '../types/api';

export const branchService = {
  findAll: (params?: Record<string, any>) =>
    api.get<ApiResponse<any[]> & { meta: PaginationMeta }>('/branches', { params }).then((r) => r.data),

  findById: (id: string) =>
    api.get<ApiResponse<any>>(`/branches/${id}`).then((r) => r.data),

  create: (data: Record<string, any>) =>
    api.post<ApiResponse<any>>('/branches', data).then((r) => r.data),

  update: (id: string, data: Record<string, any>) =>
    api.patch<ApiResponse<any>>(`/branches/${id}`, data).then((r) => r.data),

  toggleStatus: (id: string) =>
    api.patch<ApiResponse<any>>(`/branches/${id}/toggle-status`).then((r) => r.data),
};
