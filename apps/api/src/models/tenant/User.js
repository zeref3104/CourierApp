const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DEVICE_PLATFORMS, PUSH_TOKEN_PATTERN } = require('@courier/constants');

/**
 * Embedded push device-token records (push-notifications spec, design D11).
 * Token dedup is handled at the APPLICATION layer (ClientService.registerDeviceToken
 * finds an existing token before pushing). A DB unique index on a field inside an
 * embedded ARRAY (multikey) is a trap: every document with an empty deviceTokens
 * array indexes a `null` key, so the second user with deviceTokens: [] collides
 * with the first (11000 duplicate key -> 409 on /auth/client/register). Only the
 * android|ios platforms are accepted.
 */
const deviceTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      match: new RegExp(PUSH_TOKEN_PATTERN),
    },
    platform: { type: String, enum: DEVICE_PLATFORMS, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    phone: { type: String, trim: true },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    isActive: { type: Boolean, default: true },
    isClient: { type: Boolean, default: false },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    mustChangePassword: { type: Boolean, default: false },
    lastLogin: { type: Date },
    refreshToken: { type: String, select: false },
    previousRefreshTokenHash: { type: String, select: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    deviceTokens: { type: [deviceTokenSchema], default: [] },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ roleId: 1 });
userSchema.index({ branchId: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

module.exports = (connection) => connection.model('User', userSchema);