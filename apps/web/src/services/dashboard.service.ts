import api from '../config/axios';
import type { ApiResponse } from '../types/api';

export const dashboardService = {
  getSummary: () =>
    api.get<ApiResponse<any>>('/dashboard/summary').then((r) => r.data),

  getCharts: (period?: string) =>
    api.get<ApiResponse<any>>('/dashboard/charts', { params: { period } }).then((r) => r.data),

  getRecent: (limit?: number) =>
    api.get<ApiResponse<any[]>>('/dashboard/recent', { params: { limit } }).then((r) => r.data),
};