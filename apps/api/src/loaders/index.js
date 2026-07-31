const expressLoader = require('./express');
const mongooseLoader = require('./mongoose');
const socketLoader = require('./socket');
const winstonLoader = require('./winston');
const { registerListeners } = require('../events');
const tenantResolver = require('../middlewares/tenantResolver');
const logger = require('../logs/logger');

async function seedSuperAdmin(masterConnection) {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@courier.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin123456';

  const SuperAdmin = masterConnection.model('SuperAdmin');
  const exists = await SuperAdmin.findOne({ email });
  if (exists) {
    logger.info(`SuperAdmin already exists: ${email}`);
    return;
  }

  await SuperAdmin.create({ name: 'Super Admin', email, password });
  logger.info(`SuperAdmin created: ${email} / ${password}`);
}

module.exports.init = async ({ app, io }) => {
  // 1. Winston logger
  winstonLoader.init();

  // 2. MongoDB Master connection
  const masterConnection = await mongooseLoader.initMaster();
  app.locals.masterConnection = masterConnection;

  // 2b. Seed default SuperAdmin if none exists
  await seedSuperAdmin(masterConnection);

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