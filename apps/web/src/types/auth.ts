export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  mustChangePassword?: boolean;
  user: UserProfile;
}

/**
 * POST /auth/client/login response — tokens travel in the BODY (no HTTP-only
 * cookie) because this endpoint also serves the mobile app.
 */
export interface ClientLoginResponse {
  accessToken: string;
  refreshToken: string;
  client: {
    id: string;
    code: string;
    name: string;
    company: {
      slug: string;
      name: string;
      prefix: string;
    };
  };
}

export interface PublicCompany {
  id: string;
  name: string;
  slug: string;
}

export interface PublicBranch {
  id: string;
  name: string;
}

export interface RegisterClientRequest {
  companyId: string;
  branchId?: string;
  name: string;
  lastName: string;
  phone: string;
  document?: string;
  email: string;
  password: string;
  otpCode: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  permissions: string[];
  branchId?: string;
  isClient: boolean;
  clientId?: string;
}