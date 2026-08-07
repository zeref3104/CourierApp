require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seed() {
  const uri = `${process.env.MONGO_URI}/${process.env.MASTER_DB_NAME || 'courier_master'}`;
  const conn = await mongoose.createConnection(uri);

  const superAdminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, default: 'superadmin' },
    isActive: { type: Boolean, default: true },
  }, { timestamps: true });

  superAdminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
  });

  const SuperAdmin = conn.model('SuperAdmin', superAdminSchema);

  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@courier.com';
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      'FATAL: SUPER_ADMIN_PASSWORD must be set to at least 12 characters before running the seed.'
    );
  }

  const exists = await SuperAdmin.findOne({ email });
  if (exists) {
    console.log(`SuperAdmin already exists: ${email}`);
  } else {
    await SuperAdmin.create({ name: 'Super Admin', email, password });
    console.log(`SuperAdmin created: ${email} / ${password}`);
  }

  await conn.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});