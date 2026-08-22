import api from '../config/axios';
import type { ApiResponse } from '../types/api';

export interface Company {
  _id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  databaseName: string;
  isActive: boolean;
  planId?: { _id: string; name: string };
  clientCodePrefix?: string;
  settings?: {
    defaultCurrency: string;
    locale: string;
    timezone: string;
  };
  defaultPassword?: string;
  adminEmail?: string;
  createdAt: string;
}

export interface Plan {
  _id: string;
  name: string;
  code: string;
  price: number;
}

export interface License {
  _id: string;
  companyId: { _id: string; name: string; slug: string } | string;
  planId: { _id: string; name: string } | string;
  startDate: string;
  endDate: string;
  status: 'active' | 'trial' | 'expired' | 'cancelled';
  createdAt: string;
}

export interface CompanyDetail {
  company: Company;
  license: License | null;
}

export interface CreateCompanyData {
  name: string;
  slug: string;
  email: string;
  adminEmail: string;
  phone?: string;
  planId: string;
  clientCodePrefix?: string;
  licenseStartDate?: string;
  licenseEndDate?: string;
}

export const companyService = {
  findAll: (params?: Record<string, any>) =>
    api.get<ApiResponse<Company[]>>('/superadmin/companies', { params }).then((r) => r.data),

  findById: (id: string) =>
    api.get<ApiResponse<CompanyDetail>>(`/superadmin/companies/${id}`).then((r) => r.data),

  create: (data: CreateCompanyData) =>
    api.post<ApiResponse<Company>>('/superadmin/companies', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateCompanyData>) =>
    api.patch<ApiResponse<Company>>(`/superadmin/companies/${id}`, data).then((r) => r.data),

  deleteCompany: (id: string) =>
    api.delete<ApiResponse<{ deleted: boolean; slug: string; databaseName: string }>>(`/superadmin/companies/${id}`).then((r) => r.data),

  getPlans: () =>
    api.get<ApiResponse<Plan[]>>('/superadmin/plans').then((r) => r.data),

  // License CRUD
  getLicenses: (params?: Record<string, any>) =>
    api.get<ApiResponse<License[]>>('/superadmin/licenses', { params }).then((r) => r.data),

  getLicense: (id: string) =>
    api.get<ApiResponse<License>>(`/superadmin/licenses/${id}`).then((r) => r.data),

  createLicense: (data: { companyId: string; planId: string; startDate: string; endDate: string }) =>
    api.post<ApiResponse<License>>('/superadmin/licenses', data).then((r) => r.data),

  updateLicense: (id: string, data: Partial<{ planId: string; startDate: string; endDate: string; status: string }>) =>
    api.patch<ApiResponse<License>>(`/superadmin/licenses/${id}`, data).then((r) => r.data),

  deleteLicense: (id: string) =>
    api.delete<ApiResponse<{ deleted: boolean }>>(`/superadmin/licenses/${id}`).then((r) => r.data),
};
