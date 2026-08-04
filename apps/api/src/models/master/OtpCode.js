const mongoose = require('mongoose');

/**
 * Master email OTP for self-service client registration (design D5).
 * Lives on the MASTER DB (OTP is sent pre-tenant, email only).
 *
 * key is `${email}:${purpose}` (unique) so each email has exactly one live
 * code per purpose. Only the sha256 `codeHash` is stored — the plaintext is
 * emailed and never persisted. `expiresAt` carries a TTL index: MongoDB
 * deletes the document automatically once the 10-minute window passes.
 */
const otpCodeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    cooldownUntil: { type: Date },
    verifiedAt: { type: Date },
    consumedAt: { type: Date },
  },
  { timestamps: true }
);

otpCodeSchema.index({ key: 1 }, { unique: true });
// TTL index: doc is removed automatically once its code has expired.
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = otpCodeSchema;