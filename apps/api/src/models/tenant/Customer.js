const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    document: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
    miamiAddress: { type: String, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

customerSchema.index({ code: 1 }, { unique: true });
customerSchema.index({ document: 1 });
customerSchema.index({ email: 1 });
customerSchema.index({ name: 'text', lastName: 'text', document: 'text', email: 'text' });

module.exports = (connection) => connection.model('Customer', customerSchema);