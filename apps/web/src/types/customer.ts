export interface Customer {
  _id: string;
  code: string;
  name: string;
  lastName: string;
  document?: string;
  phone: string;
  email?: string;
  address?: string;
  miamiAddress?: string;
  branchId?: { _id: string; name: string; code: string };
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Computed
  totalPackages?: number;
  pendingPackages?: number;
  deliveredPackages?: number;
  totalPaid?: number;
  pendingBalance?: number;
}