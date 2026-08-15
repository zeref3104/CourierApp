const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, lowercase: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    features: {
      maxUsers: { type: Number, default: 5 },
      maxBranches: { type: Number, default: 1 },
      maxPackagesPerMonth: { type: Number, default: 500 },
      storageGB: { type: Number, default: 5 },
      apiAccess: { type: Boolean, default: false },
      reports: { type: Boolean, default: true },
      multipleBranches: { type: Boolean, default: false },
      clientPanel: { type: Boolean, default: true },
      whatsappNotifications: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

planSchema.index({ code: 1 }, { unique: true });

module.exports = planSchema;