const { z } = require('zod');

const createPaymentSchema = z.object({
  packageId: z.string().min(1, 'Package is required'),
  customerId: z.string().min(1, 'Customer is required'),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['cash', 'card', 'transfer']),
  notes: z.string().max(500).optional(),
});

module.exports = { createPaymentSchema };