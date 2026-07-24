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

export const PACKAGE_STATUS_LABELS: Record<string, string> = {
  recibido_miami: 'Recibido Miami',
  almacen_miami: 'Almacén Miami',
  en_transito: 'En Tránsito',
  llego_rd: 'Llegó a RD',
  almacen_rd: 'Almacén RD',
  disponible: 'Disponible',
  en_reparto: 'En Reparto',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  extraviado: 'Extraviado',
};