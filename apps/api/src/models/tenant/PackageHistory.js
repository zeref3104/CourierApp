const mongoose = require('mongoose');

const packageHistorySchema = new mongoose.Schema(
  {
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
    fromStatus: { type: String },
    toStatus: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

packageHistorySchema.index({ packageId: 1, createdAt: -1 });
packageHistorySchema.index({ createdAt: -1 });

module.exports = (connection) => connection.model('PackageHistory', packageHistorySchema);