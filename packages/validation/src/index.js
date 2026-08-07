/**
 * Shared Zod validation schemas for Courier SaaS Platform.
 * Single source of truth for request validation.
 * Can be used by both API (Node.js require) and web (ESM import via bundler).
 *
 * Ported 1:1 from apps/api/src/validators/schemas/*.js (they are the behavioral
 * source of truth — rebuilt in batches 4/5). Do NOT edit API-local schemas.
 */

const { z } = require('zod');
const {
  CLIENT_CODE_PREFIX_PATTERN,
  CLIENT_CODE_PATTERN,
  DEVICE_PLATFORMS,
  PUSH_TOKEN_PATTERN,
} = require('@courier/constants');

const PACKAGE_STATUSES = [
  'recibido_miami', 'almacen_miami', 'en_transito', 'llego_rd',
  'almacen_rd', 'disponible', 'en_reparto', 'entregado',
  'cancelado', 'extraviado',
];

// --- Auth (auth.schema.js) ---
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const clientLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const superadminLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
});

// --- User (user.schema.js) ---
const createUserSchema = z.object({
  name: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50).optional(),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
  phone: z.string().optional(),
  roleId: z.string().min(1, 'Role is required'),
  branchId: z.string().optional(),
});

const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .extend({ isActive: z.boolean().optional() });

// --- Delivery (delivery.schema.js) ---
const createDeliverySchema = z.object({
  packageId: z.string().min(1, 'Package is required'),
  type: z.enum(['branch', 'home']),
  receiverName: z.string().min(1, 'Receiver name is required').max(100),
  receiverDocument: z.string().min(1, 'Receiver document is required').max(20),
  receiverPhone: z.string().optional(),
  address: z.string().optional(),
  branchId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// Receiver identity is captured when the delivery is created; completing a
// delivery must not require re-sending it (the service only merges optional
// corrections and finalizes delivery).
const completeDeliverySchema = z.object({
  receiverName: z.string().min(1).max(100).optional(),
  receiverDocument: z.string().min(1).max(20).optional(),
  notes: z.string().max(500).optional(),
});

// --- Role (role.schema.js) ---
const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  code: z.string().min(2).max(30).regex(/^[a-z0-9_-]+$/, 'Code must be lowercase letters, numbers, underscores or hyphens'),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).default([]),
});

const updateRoleSchema = createRoleSchema.partial();

// --- Branch (branch.schema.js) ---
const createBranchSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(1).max(20),
  address: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  isActive: z.boolean().optional(),
  isMainBranch: z.boolean().optional(),
  managerId: z.string().optional(),
});

const updateBranchSchema = createBranchSchema.partial();

// --- Setting (setting.schema.js) ---
// Settings are bulk-upserted as { key: value }. Only known keys are allowed
// and each key has a validated value type. Unknown keys are rejected.
const updateSettingsSchema = z.object({
  company_name: z.string().max(200).optional(),
  company_address: z.string().max(300).optional(),
  company_phone: z.string().max(30).optional(),
  company_email: z.string().email('Invalid email format').optional(),
  rnc: z.string().max(20).optional(),
  currency: z.enum(['DOP', 'USD', 'EUR']).optional(),
  price_per_lb: z.number().min(0).optional(),
  minimum_price: z.number().min(0).optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  logo_url: z.string().optional(),
  language: z.enum(['es', 'en', 'fr']).optional(),
}).strict();

// --- Customer (customer.schema.js) ---
const createCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  lastName: z.string().min(2).max(50),
  document: z.string().min(6).max(15).optional(),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(200).optional(),
  branchId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

// --- Package (package.schema.js) ---
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

// --- Payment (payment.schema.js) ---
const createPaymentSchema = z.object({
  packages: z.array(z.string()).min(1, 'At least one package is required'),
  customerId: z.string().min(1, 'Customer is required'),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['cash', 'card', 'transfer']),
  notes: z.string().max(500).optional(),
});

// --- Rate (rate.schema.js) ---
const createRateSchema = z.object({
  name: z.string().min(1).max(100),
  pricePerLb: z.number().positive(),
  minimumPrice: z.number().min(0).default(0),
  tax: z.number().min(0).default(18),
  weightLimit: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

const updateRateSchema = createRateSchema.partial();

// --- Company (company.schema.js) ---
// Payload for superadmin company provisioning. clientCodePrefix is optional:
// when absent, the service suggests one from the company name (design D2).
const createCompanySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  slug: z.string().min(2, 'Slug must be at least 2 characters').max(50),
  email: z.string().email('Invalid email format'),
  adminEmail: z.string().email('Invalid admin email format'),
  phone: z.string().optional(),
  planId: z.string().optional(),
  clientCodePrefix: z
    .string()
    .regex(new RegExp(CLIENT_CODE_PREFIX_PATTERN), 'Client code prefix must be 2-5 uppercase letters')
    .optional(),
});

const updateCompanySchema = createCompanySchema
  .partial()
  .omit({ clientCodePrefix: true }) // prefix is set once and immutable (design D1/D7)
  .extend({ isActive: z.boolean().optional(), isSuspended: z.boolean().optional() });

// --- Client registration OTP (client-registration spec, design D5/D6) ---
// 6-digit numeric code, emailed and stored hashed on the master DB.
const otpCode = z
  .string()
  .regex(/^\d{6}$/, 'OTP code must be exactly 6 digits');

// POST /auth/client/otp/send — request a fresh code (60s cooldown enforced in service)
const otpSendSchema = z.object({
  email: z.string().email('Invalid email format'),
  lang: z.enum(['es', 'en', 'fr']).optional(),
});

// POST /auth/client/otp/verify — submit the emailed code (single-use)
const otpVerifySchema = z.object({
  email: z.string().email('Invalid email format'),
  code: otpCode,
});

// POST /auth/client/register — create the client account once the OTP is verified
const registerClientSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  branchId: z.string().min(1, 'branchId is required'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  phone: z.string().min(7, 'Phone must be at least 7 characters').max(20),
  document: z.string().max(30).optional(),
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  otpCode,
});

// --- Client code login + body refresh (client-code-login spec, design D9/D10) ---
// POST /auth/client/login — the global client code {PREFIX}-{SEQ} IS the login
// identifier; an email is explicitly NOT accepted (auth-specs delta §2.1).
const clientCodeLoginSchema = z.object({
  code: z
    .string()
    .regex(new RegExp(CLIENT_CODE_PATTERN), 'Code must be a valid client code (e.g. CS-000001)'),
  password: z.string().min(1, 'Password is required'),
});

// POST /auth/client/refresh — refresh token travels in the request BODY for
// React Native (no HTTP-only cookie jar, design D10).
const clientRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// POST /client/device-token — register a push device for the authenticated
// client (push-notifications spec, design D11). token must be an Expo push
// token (rejected 422 otherwise); platform is android|ios.
const deviceTokenSchema = z.object({
  token: z
    .string()
    .regex(new RegExp(PUSH_TOKEN_PATTERN), 'Token must be a valid Expo push token (ExponentPushToken[...])'),
  platform: z.enum(DEVICE_PLATFORMS),
});

module.exports = {
  loginSchema,
  clientLoginSchema,
  superadminLoginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  createDeliverySchema,
  completeDeliverySchema,
  createRoleSchema,
  updateRoleSchema,
  createBranchSchema,
  updateBranchSchema,
  updateSettingsSchema,
  createCustomerSchema,
  updateCustomerSchema,
  createPackageSchema,
  updatePackageSchema,
  changeStatusSchema,
  createPaymentSchema,
  createRateSchema,
  updateRateSchema,
  createCompanySchema,
  updateCompanySchema,
  otpSendSchema,
  otpVerifySchema,
  registerClientSchema,
  clientCodeLoginSchema,
  clientRefreshSchema,
  deviceTokenSchema,
};
