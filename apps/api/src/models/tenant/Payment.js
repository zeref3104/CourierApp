const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    packages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true }],
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['cash', 'card', 'transfer'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'paid',
    },
    receiptNumber: { type: String, unique: true, sparse: true },
    processedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    notes: { type: String, trim: true },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

paymentSchema.index({ receiptNumber: 1 }, { unique: true, sparse: true });
paymentSchema.index({ packages: 1 });
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paidAt: -1 });

module.exports = (connection) => connection.model('Payment', paymentSchema);