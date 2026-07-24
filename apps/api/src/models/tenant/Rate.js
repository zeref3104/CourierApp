const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    pricePerLb: { type: Number, required: true, min: 0 },
    minimumPrice: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    weightLimit: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

rateSchema.index({ isActive: 1 });

module.exports = (connection) => connection.model('Rate', rateSchema);