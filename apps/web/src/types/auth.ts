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