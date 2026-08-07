const expressLoader = require('./express');
const mongooseLoader = require('./mongoose');
const socketLoader = require('./socket');
const winstonLoader = require('./winston');
const { registerListeners } = require('../events');
const tenantResolver = require('../middlewares/tenantResolver');
const logger = require('../logs/logger');

/**
 * Resolve the super-admin credentials strictly. Never falls back to a weak
 * default (previously 'Admin123456'): an unset or too-short password must fail
 * and stop the process rather than silently provisioning a guessable admin.
 */
function resolveSuperAdminCredentials() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@courier.com';
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      'FATAL: SUPER_ADMIN_PASSWORD must be set to at least 12 characters before the server can seed the super admin.'
    );
  }
  return { email, password };
}

async function seedSuperAdmin(masterConnection) {
  const { email, password } = resolveSuperAdminCredentials();

  const SuperAdmin = masterConnection.model('SuperAdmin');
  const exists = await SuperAdmin.findOne({ email });
  if (exists) {
    logger.info(`SuperAdmin already exists: ${email}`);
    return;
  }

  await SuperAdmin.create({ name: 'Super Admin', email, password });
  logger.info(`SuperAdmin created: ${email} / ${password}`);
}

/**
 * Seed default subscription plans when the master DB has none. Company
 * creation requires a plan (License.planId is mandatory), so a fresh DB with
 * zero plans deadlocks the superadmin onboarding flow — the form says "create
 * a plan first" but no UI exists to create one. This seeds a sensible default
 * tier set idempotently on first boot.
 */
const DEFAULT_PLANS = [
  {
    name: 'Básico',
    code: 'basico',
    description: 'Plan inicial para emprendimientos',
    price: 0,
    features: {
      maxUsers: 5,
      maxBranches: 1,
      maxPackagesPerMonth: 500,
      storageGB: 5,
      apiAccess: false,
      reports: true,
      multipleBranches: false,
      clientPanel: true,
      whatsappNotifications: false,
    },
  },
  {
    name: 'Profesional',
    code: 'profesional',
    description: 'Plan para negocios en crecimiento',
    price: 49,
    features: {
      maxUsers: 20,
      maxBranches: 5,
      maxPackagesPerMonth: 5000,
      storageGB: 50,
      apiAccess: true,
      reports: true,
      multipleBranches: true,
      clientPanel: true,
      whatsappNotifications: true,
    },
  },
  {
    name: 'Empresarial',
    code: 'empresarial',
    description: 'Plan completo para grandes operaciones',
    price: 149,
    features: {
      maxUsers: 100,
      maxBranches: 20,
      maxPackagesPerMonth: 50000,
      storageGB: 200,
      apiAccess: true,
      reports: true,
      multipleBranches: true,
      clientPanel: true,
      whatsappNotifications: true,
    },
  },
];

async function seedPlans(masterConnection) {
  const Plan = masterConnection.model('Plan');
  const count = await Plan.countDocuments();
  if (count > 0) {
    logger.info(`Plans already seeded (${count}); skipping default plans`);
    return;
  }

  await Plan.insertMany(DEFAULT_PLANS);
  logger.info(`Seeded ${DEFAULT_PLANS.length} default plans`);
}

module.exports.init = async ({ app, io }) => {
  // 1. Winston logger
  winstonLoader.init();

  // 2. MongoDB Master connection
  const masterConnection = await mongooseLoader.initMaster();
  app.locals.masterConnection = masterConnection;

  // 2b. Seed default SuperAdmin if none exists
  await seedSuperAdmin(masterConnection);

  // 2c. Seed default plans if none exist (company creation requires a plan)
  await seedPlans(masterConnection);

  // 3. Express middlewares
  expressLoader.init({ app });

  // 4. Tenant resolver (applied to all /api/v1 routes except superadmin)
  app.use('/api/v1', tenantResolver);

  // 5. Socket.io
  socketLoader.init({ io, app });

  // 6. Routes
  app.use('/api/v1', require('../routes/v1'));

  // 6b. 404 for unmatched routes (after all routes, before the error handler)
  app.use(require('../middlewares/notFound'));

  // 7. Event listeners
  registerListeners();

  logger.info('All loaders initialized');
};