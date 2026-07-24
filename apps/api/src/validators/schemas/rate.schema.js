const { z } = require('zod');

const createRateSchema = z.object({
  name: z.string().min(1).max(100),
  pricePerLb: z.number().positive(),
  minimumPrice: z.number().min(0).default(0),
  tax: z.number().min(0).default(18),
  weightLimit: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

const updateRateSchema = createRateSchema.partial();

module.exports = { createRateSchema, updateRateSchema };