const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'trial'],
      default: 'trial',
    },
    autoRenew: { type: Boolean, default: false },
    paymentMethod: { type: String },
    lastPaymentDate: { type: Date },
    nextBillingDate: { type: Date },
  },
  { timestamps: true }
);

licenseSchema.index({ companyId: 1, status: 1 });
licenseSchema.index({ endDate: 1 });

module.exports = licenseSchema;