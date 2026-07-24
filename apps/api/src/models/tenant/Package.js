const mongoose = require('mongoose');

const PACKAGE_STATUSES = [
  'recibido_miami',
  'almacen_miami',
  'en_transito',
  'llego_rd',
  'almacen_rd',
  'disponible',
  'en_reparto',
  'entregado',
  'cancelado',
  'extraviado',
];

const packageSchema = new mongoose.Schema(
  {
    tracking: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    description: { type: String, required: true, trim: true },
    weight: { type: Number, required: true, min: 0, max: 500 },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    declaredValue: { type: Number, min: 0, default: 0 },
    cost: { type: Number, min: 0, default: 0 },
    shippingCost: { type: Number, min: 0, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: PACKAGE_STATUSES, default: 'recibido_miami' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    photos: [{ type: String }],
    notes: { type: String, trim: true },
    isPaid: { type: Boolean, default: false },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    receivedAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
    deliveredById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

packageSchema.index({ tracking: 1 }, { unique: true });
packageSchema.index({ customerId: 1, status: 1 });
packageSchema.index({ status: 1, branchId: 1 });
packageSchema.index({ createdAt: -1 });
packageSchema.index({ tracking: 'text', description: 'text' });

module.exports = (connection) => connection.model('Package', packageSchema);