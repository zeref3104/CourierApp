export interface TrackingNumberParams {
  seq: number;
  date: string;
  prefix?: string;
}

export interface ReceiptNumberParams {
  seq: number;
  date: string;
}

export declare function generateTrackingNumber(params: TrackingNumberParams): string;
export declare function generateReceiptNumber(params: ReceiptNumberParams): string;
/** @deprecated Use generateClientCode(prefix, seq) for new customers. */
export declare function generateCustomerCode(seq: number): string;
export declare function suggestClientPrefix(companyName: string): string;
export declare function generateClientCode(prefix: string, seq: number): string;
export declare function calculatePricing(
  weight: number,
  pricePerLb: number,
  minimumPrice?: number,
  taxRate?: number
): { baseCost: number; tax: number; total: number };
export declare function formatCurrency(amount: number, currency?: string): string;
export declare function getTodayStart(): Date;
export declare function getTodayEnd(): Date;
export declare function getMonthStart(): Date;
export declare function getMonthEnd(): Date;
export declare function paginate<T = unknown>(
  items: T[],
  page?: number,
  limit?: number
): { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } };
