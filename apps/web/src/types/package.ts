export interface Package {
  _id: string;
  tracking: string;
  customerId: { _id: string; name: string; lastName: string; code: string };
  description: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  declaredValue: number;
  cost: number;
  shippingCost: number;
  tax: number;
  total: number;
  status: string;
  branchId?: { _id: string; name: string };
  photos: string[];
  notes?: string;
  isPaid: boolean;
  receivedAt: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackageHistory {
  _id: string;
  packageId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: { _id: string; name: string };
  notes?: string;
  createdAt: string;
}

/**
 * Client-panel package detail (GET /client/packages/:tracking).
 * `amountToPay`, `pickupBranch` and `currency` are present ONLY when
 * status === 'disponible'; for any other status the backend strips the
 * amount-bearing fields and no price section must be rendered.
 */
export interface ClientPackageDetail {
  _id: string;
  tracking: string;
  status: string;
  description?: string;
  weight?: number;
  createdAt: string;
  deliveredAt?: string | null;
  history?: PackageHistory[];
  amountToPay?: number;
  currency?: string;
  pickupBranch?: { id?: string; name: string; address?: string } | null;
}