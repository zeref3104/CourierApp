const { z } = require('zod');

const createPackageSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
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
  status: z.enum([
    'recibido_miami', 'almacen_miami', 'en_transito', 'llego_rd',
    'almacen_rd', 'disponible', 'en_reparto', 'entregado',
    'cancelado', 'extraviado',
  ]),
  notes: z.string().max(500).optional(),
});

module.exports = { createPackageSchema, updatePackageSchema, changeStatusSchema };