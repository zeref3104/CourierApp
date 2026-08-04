const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    logo: { type: String },
    databaseName: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    settings: {
      defaultCurrency: { type: String, default: 'DOP' },
      locale: { type: String, default: 'es-DO' },
      timezone: { type: String, default: 'America/Santo_Domingo' },
    },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    // Global client identity prefix (client-code-identity spec): platform-unique,
    // 2-5 uppercase letters, set once at provisioning and never modified.
    // Sparse unique index: legacy companies created before this field have no value.
    clientCodePrefix: {
      type: String,
      trim: true,
      match: [/^[A-Z]{2,5}$/, 'Client code prefix must be 2-5 uppercase letters'],
    },
  },
  { timestamps: true }
);

companySchema.index({ slug: 1 }, { unique: true });
companySchema.index({ databaseName: 1 }, { unique: true });
companySchema.index({ clientCodePrefix: 1 }, { unique: true, sparse: true });

module.exports = companySchema;