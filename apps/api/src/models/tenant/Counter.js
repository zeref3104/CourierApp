const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.index({ key: 1 }, { unique: true });

module.exports = (connection) => connection.model('Counter', counterSchema);
