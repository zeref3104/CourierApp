import api from '../config/axios';
import type { ApiResponse } from '../types/api';
import type { ClientLoginResponse, LoginRequest, LoginResponse, PublicCompany, PublicBranch, RegisterClientRequest } from '../types/auth';

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

  getPublicCompanies: () =>
    api.get<ApiResponse<PublicCompany[]>>('/public/companies').then((r) => r.data),

  getPublicBranches: (companyId: string) =>
    api.get<ApiResponse<PublicBranch[]>>(`/public/companies/${companyId}/branches`).then((r) => r.data),

  sendOtp: (data: { email: string; lang: string }) =>
    api.post<ApiResponse<{ message: string }>>('/auth/client/otp/send', data).then((r) => r.data),

  verifyOtp: (data: { email: string; code: string }) =>
    api.post<ApiResponse<{ verified: boolean }>>('/auth/client/otp/verify', data).then((r) => r.data),

  registerClient: (data: RegisterClientRequest) =>
    api.post<ApiResponse<ClientLoginResponse>>('/auth/client/register', data).then((r) => r.data),
};