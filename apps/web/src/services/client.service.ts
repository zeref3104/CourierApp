import api from '../config/axios';
import type { ApiResponse } from '../types/api';

export const clientService = {
  getDashboard: () =>
    api.get<ApiResponse<any>>('/client/dashboard').then((r) => r.data),
};
