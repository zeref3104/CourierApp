import api from '../config/axios';
import type { ApiResponse } from '../types/api';
import type { ClientLoginResponse, LoginRequest, LoginResponse } from '../types/auth';

export const authService = {
  login: (data: LoginRequest) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', data).then((r) => r.data),

  clientLogin: (data: LoginRequest) =>
    api.post<ApiResponse<ClientLoginResponse>>('/auth/client/login', data).then((r) => r.data),

  refresh: () =>
    api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh').then((r) => r.data),

  logout: () => api.post('/auth/logout').then((r) => r.data),

  me: () => api.get<ApiResponse<any>>('/auth/me').then((r) => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch<ApiResponse<{ message: string }>>('/auth/password', data).then((r) => r.data),
};