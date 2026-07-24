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
  },
  { timestamps: true }
);

companySchema.index({ slug: 1 }, { unique: true });
companySchema.index({ databaseName: 1 }, { unique: true });

module.exports = companySchema;