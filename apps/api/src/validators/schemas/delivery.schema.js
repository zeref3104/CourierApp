const { z } = require('zod');

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

const completeDeliverySchema = z.object({
  receiverName: z.string().min(1).max(100),
  receiverDocument: z.string().min(1).max(20),
  notes: z.string().max(500).optional(),
});

module.exports = { createDeliverySchema, completeDeliverySchema };