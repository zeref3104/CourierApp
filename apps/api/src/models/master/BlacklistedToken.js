const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema(
  {
    hashedToken: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

// TTL index: MongoDB automatically removes documents when expiresAt is reached
blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = blacklistedTokenSchema;
