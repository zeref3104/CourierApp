const mongoose = require('mongoose');

/**
 * Master per-company sequence counter (client-code-identity spec, D3).
 * The master DB is the single authority for global client code sequences,
 * so codes are distinct across all tenants.
 */
const companyCounterSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

companyCounterSchema.index({ companyId: 1 }, { unique: true });

module.exports = companyCounterSchema;
