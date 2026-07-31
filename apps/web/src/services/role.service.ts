import api from '../config/axios';
import type { ApiResponse } from '../types/api';

export const roleService = {
  findAll: () =>
    api.get<ApiResponse<any[]>>('/roles').then((r) => r.data),
};
