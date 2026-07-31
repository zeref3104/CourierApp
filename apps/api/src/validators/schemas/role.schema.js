const { z } = require('zod');

const createRoleSchema = z.object({
  name: z.string().min(2).max(50),
  code: z.string().min(2).max(30).regex(/^[a-z0-9_-]+$/, 'Code must be lowercase letters, numbers, underscores or hyphens'),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).default([]),
});

const updateRoleSchema = createRoleSchema.partial();

module.exports = { createRoleSchema, updateRoleSchema };
