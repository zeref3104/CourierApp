export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  mustChangePassword?: boolean;
  user: UserProfile;
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