const { z } = require('zod');

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

module.exports = { createBranchSchema, updateBranchSchema };
