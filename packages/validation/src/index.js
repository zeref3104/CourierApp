/**
 * Shared Zod validation schemas for Courier SaaS Platform.
 * Can be used by both API (Node.js require) and web (ESM import via bundler).
 */

const { z } = require('zod');

const PACKAGE_STATUSES = [
  'recibido_miami', 'almacen_miami', 'en_transito', 'llego_rd',
  'almacen_rd', 'disponible', 'en_reparto', 'entregado',
  'cancelado', 'extraviado',
];

// --- Auth ---
const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// --- Customer ---
const createCustomerSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20),
  name: z.string().min(1, 'Name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  document: z.string().max(30).optional(),
  phone: z.string().min(1, 'Phone is required').max(20),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(300).optional(),
  miamiAddress: z.string().max(300).optional(),
  branchId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

// --- Package ---
const createPackageSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  carrierTracking: z.string().max(100).optional(),
  description: z.string().min(1, 'Description is required').max(500),
  weight: z.number().positive('Weight must be positive').max(500),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  declaredValue: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
  branchId: z.string().optional(),
});

const updatePackageSchema = createPackageSchema.partial();

const changeStatusSchema = z.object({
  status: z.enum(PACKAGE_STATUSES),
  notes: z.string().max(500).optional(),
});

// --- Payment ---
const createPaymentSchema = z.object({
  packageId: z.string().min(1, 'Package is required'),
  customerId: z.string().min(1, 'Customer is required'),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['cash', 'card', 'transfer']),
  notes: z.string().max(500).optional(),
});

// --- Delivery ---
const createDeliverySchema = z.object({
  packageId: z.string().min(1, 'Package is required'),
  type: z.enum(['branch', 'home']),
  receiverName: z.string().min(1, 'Receiver name is required').max(100),
  receiverDocument: z.string().min(1, 'Receiver document is required').max(30),
  receiverPhone: z.string().max(20).optional(),
  address: z.string().max(300).optional(),
  branchId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// --- User ---
const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().max(20).optional(),
  roleId: z.string().min(1, 'Role is required'),
  branchId: z.string().optional(),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true });

// --- Rate ---
const createRateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  pricePerLb: z.number().positive('Price must be positive'),
  minimumPrice: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  weightLimit: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

const updateRateSchema = createRateSchema.partial();

module.exports = {
  loginSchema,
  changePasswordSchema,
  createCustomerSchema,
  updateCustomerSchema,
  createPackageSchema,
  updatePackageSchema,
  changeStatusSchema,
  createPaymentSchema,
  createDeliverySchema,
  createUserSchema,
  updateUserSchema,
  createRateSchema,
  updateRateSchema,
};
