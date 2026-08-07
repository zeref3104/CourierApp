import { api } from '@/lib/api';
import type { ClientProfile } from '@/stores/authStore';
import type { TenantContext } from '@/stores/tenantStore';

/**
 * Typed wrappers around the client auth endpoints. All responses use the
 * API-envelope `{ success, data, message }` (apps/api/src/utils/apiResponse.js),
 * so each function returns `response.data.data`. The envelope `.data` is the
 * payload; the inner `.data` is the business object.
 */

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  client: ClientProfile;
}

/** POST /auth/client/login — code + password only, no email/company. */
export async function loginClient(code: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<{ data: LoginResponse }>('/auth/client/login', { code, password });
  return data.data;
}

interface RegisterPayload {
  companyId: string;
  branchId: string;
  name: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  document?: string;
  otpCode: string;
}

interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
  client: ClientProfile;
}

/** POST /auth/client/register — auto-login on success. */
export async function registerClient(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await api.post<{ data: RegisterResponse }>('/auth/client/register', payload);
  return data.data;
}

/**
 * Build the persisted tenant context from a login/register client payload.
 * - Login: client.company carries slug/prefix (no company id).
 * - Register: the API response has no company object, so the caller passes the
 *   company picked from the public selector (id + slug) explicitly.
 */
export function tenantContextFrom(
  client: ClientProfile,
  companyId: string,
  companySlugOverride?: string,
): TenantContext {
  return {
    companyId,
    companySlug: client.company?.slug ?? companySlugOverride ?? '',
    companyPrefix: client.company?.prefix ?? client.code.split('-')[0] ?? '',
    clientId: client.id,
  };
}

/** Public company shape from GET /public/companies. */
export interface PublicCompany {
  id: string;
  slug: string;
  name: string;
}

/** GET /public/companies — active, licensed companies for registration. */
export async function fetchPublicCompanies(): Promise<PublicCompany[]> {
  const { data } = await api.get<{ data: PublicCompany[] }>('/public/companies');
  return data.data;
}

/** Public branch shape from GET /public/companies/:id/branches. */
export interface PublicBranch {
  id: string;
  name: string;
  address?: string;
}

/** GET /public/companies/:id/branches — active branches of a company. */
export async function fetchPublicBranches(companyId: string): Promise<PublicBranch[]> {
  const { data } = await api.get<{ data: PublicBranch[] }>(`/public/companies/${companyId}/branches`);
  return data.data;
}

/** POST /auth/client/otp/send — request a verification code. */
export async function sendOtp(email: string, lang = 'es'): Promise<{ sent: boolean; resendAfter?: number }> {
  const { data } = await api.post<{ data: { sent: boolean; resendAfter?: number } }>('/auth/client/otp/send', {
    email,
    lang,
  });
  return data.data;
}

/** POST /auth/client/otp/verify — confirm the verification code. */
export async function verifyOtp(email: string, code: string): Promise<{ verified: boolean }> {
  const { data } = await api.post<{ data: { verified: boolean } }>('/auth/client/otp/verify', { email, code });
  return data.data;
}