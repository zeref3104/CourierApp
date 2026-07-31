const { z } = require('zod');

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
}).strict();

module.exports = { updateSettingsSchema };
