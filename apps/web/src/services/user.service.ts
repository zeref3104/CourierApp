import api from '../config/axios';
import type { ApiResponse, PaginationMeta } from '../types/api';

export const userService = {
  findAll: (params?: Record<string, any>) =>
    api.get<ApiResponse<any[]> & { meta: PaginationMeta }>('/users', { params }).then((r) => r.data),

  findById: (id: string) =>
    api.get<ApiResponse<any>>(`/users/${id}`).then((r) => r.data),

  create: (data: Record<string, any>) =>
    api.post<ApiResponse<any>>('/users', data).then((r) => r.data),

  update: (id: string, data: Record<string, any>) =>
    api.patch<ApiResponse<any>>(`/users/${id}`, data).then((r) => r.data),
};
