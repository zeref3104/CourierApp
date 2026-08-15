const mongoose = require('mongoose');

const tenantUserIndexSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    tenantSlug: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

tenantUserIndexSchema.index({ email: 1 }, { unique: true });

module.exports = tenantUserIndexSchema;