const mongoose = require('mongoose');

/**
 * Master-DB email → tenant index for CLIENT accounts (client-email-login).
 *
 * Deliberately NOT a `kind` discriminator on TenantUserIndex: that model's
 * email is GLOBALLY unique, but the same client email MUST be allowed in
 * multiple companies (multi-tenant reality). This dedicated collection keeps
 * per-company uniqueness (compound unique index) so a single email can point
 * at several tenants — email login resolves the tenant only when exactly one
 * company holds that email, otherwise it answers "ambiguous".
 */
const clientEmailIndexSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique per company, NOT globally: one email may index several companies.
clientEmailIndexSchema.index({ email: 1, companyId: 1 }, { unique: true });

module.exports = clientEmailIndexSchema;