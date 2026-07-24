import api from '../config/axios';
import type { ApiResponse, PaginationMeta } from '../types/api';

export const packageService = {
  findAll: (params?: Record<string, any>) =>
    api.get<ApiResponse<any[]> & { meta: PaginationMeta }>('/packages', { params }).then((r) => r.data),

  create: (data: FormData | Record<string, any>) =>
    api.post<ApiResponse<any>>('/packages', data, {
      headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }).then((r) => r.data),

  findByTracking: (tracking: string) =>
    api.get<ApiResponse<any>>(`/packages/${tracking}`).then((r) => r.data),

  findById: (id: string) =>
    api.get<ApiResponse<any>>(`/packages/id/${id}`).then((r) => r.data),

  update: (id: string, data: Record<string, any>) =>
    api.patch<ApiResponse<any>>(`/packages/${id}`, data).then((r) => r.data),

  changeStatus: (id: string, status: string, notes?: string) =>
    api.patch<ApiResponse<any>>(`/packages/${id}/status`, { status, notes }).then((r) => r.data),

  getHistory: (id: string) =>
    api.get<ApiResponse<any[]>>(`/packages/${id}/history`).then((r) => r.data),

  uploadPhotos: (id: string, files: FormData) =>
    api.post<ApiResponse<string[]>>(`/packages/${id}/photos`, files, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
};