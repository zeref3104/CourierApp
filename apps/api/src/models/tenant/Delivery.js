const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema(
  {
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
    type: { type: String, enum: ['branch', 'home'], required: true },
    receiverName: { type: String, required: true, trim: true },
    receiverDocument: { type: String, required: true, trim: true },
    receiverPhone: { type: String, trim: true },
    address: { type: String, trim: true },
    deliveredById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    notes: { type: String, trim: true },
    photos: [{ type: String }],
    deliveredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

deliverySchema.index({ packageId: 1 });
deliverySchema.index({ deliveredById: 1 });
deliverySchema.index({ deliveredAt: -1 });

module.exports = (connection) => connection.model('Delivery', deliverySchema);