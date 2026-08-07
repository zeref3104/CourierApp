import { api } from '@/lib/api';

/**
 * Typed wrappers around the client panel endpoints (client-panel-specs delta):
 *   GET /client/dashboard            -> four stats + last 5 packages
 *   GET /client/packages             -> paginated package list (status filter)
 *   GET /client/packages/:tracking   -> detail + PackageHistory timeline
 *
 * All responses use the API envelope `{ success, data, meta }`
 * (apps/api/src/utils/apiResponse.js), so each function returns
 * `response.data.data` (the payload) and `response.data.meta` (pagination).
 */

export interface DashboardStats {
  totalPackages: number;
  inTransit: number;
  readyForPickup: number;
  delivered: number;
  lastTracking: Array<{ tracking: string; status: string; createdAt: string }>;
}

export interface PackageSummary {
  _id: string;
  tracking: string;
  carrierTracking?: string;
  description?: string;
  weight?: number;
  status: string;
  cost?: number;
  total?: number;
  createdAt: string;
  deliveredAt?: string | null;
  photos?: string[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PackageHistoryEntry {
  _id?: string;
  status: string;
  createdAt: string;
  changedBy?: { _id: string; name: string } | null;
  note?: string;
}

/** Pickup branch shape — populated only for `disponible` packages (spec gate). */
export interface PickupBranch {
  id?: string;
  name: string;
  address?: string;
}

/**
 * Package detail. `amountToPay` + `pickupBranch` are present ONLY when
 * status === 'disponible'; for any other status the backend strips the
 * amount-bearing fields and we must NOT render an amount card.
 */
export interface PackageDetail {
  _id: string;
  tracking: string;
  status: string;
  description?: string;
  weight?: number;
  createdAt: string;
  deliveredAt?: string | null;
  branchId?: { _id: string; name: string; address?: string } | null;
  amountToPay?: number;
  pickupBranch?: PickupBranch | null;
  history: PackageHistoryEntry[];
  [key: string]: unknown;
}

export interface PackagesQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export interface PackagesPage {
  items: PackageSummary[];
  meta: PaginationMeta;
}

/** GET /client/dashboard — the four stats + recent packages. */
export async function fetchDashboard(): Promise<DashboardStats> {
  const { data } = await api.get<{ data: DashboardStats }>('/client/dashboard');
  return data.data;
}

/** GET /client/packages — paginated list with optional status filter. */
export async function fetchPackages(query: PackagesQuery = {}): Promise<PackagesPage> {
  const { data } = await api.get<{ data: PackageSummary[]; meta: PaginationMeta }>('/client/packages', {
    params: query,
  });
  return { items: data.data, meta: data.meta };
}

/** GET /client/packages/:tracking — detail + chronological history timeline. */
export async function fetchPackageByTracking(tracking: string): Promise<PackageDetail> {
  const { data } = await api.get<{ data: PackageDetail }>(`/client/packages/${encodeURIComponent(tracking)}`);
  return data.data;
}

/**
 * Profile shape returned by GET/PATCH /client/profile — the Customer document
 * (populated branch). The backend `client.service.updateProfile` updates
 * email/phone/address; everything else is read-only for the client.
 */
export interface ClientProfileDetail {
  _id: string;
  code: string;
  name: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  miamiAddress?: string;
  branchId?: { _id: string; name: string; address?: string; phone?: string } | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** PATCH /client/profile body — only the updatable fields. */
export interface ProfilePatch {
  email?: string;
  phone?: string;
  address?: string;
}

/** GET /client/profile — read the authenticated client's own profile. */
export async function fetchProfile(): Promise<ClientProfileDetail> {
  const { data } = await api.get<{ data: ClientProfileDetail }>('/client/profile');
  return data.data;
}

/** PATCH /client/profile — update email/phone/address; returns the updated profile. */
export async function updateProfile(patch: ProfilePatch): Promise<ClientProfileDetail> {
  const { data } = await api.patch<{ data: ClientProfileDetail }>('/client/profile', patch);
  return data.data;
}
