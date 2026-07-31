const { z } = require('zod');

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

module.exports = { createUserSchema, updateUserSchema };