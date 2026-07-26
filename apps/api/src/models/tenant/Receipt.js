const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema(
  {
    receiptNumber: { type: String, required: true, unique: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    packages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true }],
    items: [
      {
        description: { type: String, required: true },
        amount: { type: Number, required: true },
        tax: { type: Number, default: 0 },
        total: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    method: { type: String },
    generatedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    pdfUrl: { type: String },
  },
  { timestamps: true }
);

receiptSchema.index({ receiptNumber: 1 }, { unique: true });
receiptSchema.index({ paymentId: 1 });

module.exports = (connection) => connection.model('Receipt', receiptSchema);