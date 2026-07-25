const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
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
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
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