const expressLoader = require('./express');
const mongooseLoader = require('./mongoose');
const socketLoader = require('./socket');
const winstonLoader = require('./winston');
const { registerListeners } = require('../events');
const tenantResolver = require('../middlewares/tenantResolver');
const logger = require('../logs/logger');

module.exports.init = async ({ app, io }) => {
  // 1. Winston logger
  winstonLoader.init();

  // 2. MongoDB Master connection
  const masterConnection = await mongooseLoader.initMaster();
  app.locals.masterConnection = masterConnection;

  // 3. Express middlewares
  expressLoader.init({ app });

  // 4. Tenant resolver (applied to all /api/v1 routes except superadmin)
  app.use('/api/v1', tenantResolver);

  // 5. Socket.io
  socketLoader.init({ io, app });

  // 6. Routes
  app.use('/api/v1', require('../routes/v1'));

  // 7. Event listeners
  registerListeners();

  logger.info('All loaders initialized');
};