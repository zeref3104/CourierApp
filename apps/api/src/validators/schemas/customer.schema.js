const { z } = require('zod');

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

module.exports = { createCustomerSchema, updateCustomerSchema };