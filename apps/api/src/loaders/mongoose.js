const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../logs/logger');
const { buildDbUri } = require('../utils/mongoUri');

/**
 * Compose the master URI by inserting the db name BEFORE any query string.
 * A naive `${uri}/${db}` would corrupt a MONGO_URI carrying options, turning
 * "?authSource=admin" into "?authSource=<db>/admin" (InvalidNamespace).
 */
function buildMasterUri() {
  const { uri, masterDbName } = config.mongo;
  return buildDbUri(uri, masterDbName);
}

async function initMaster() {
  const uri = buildMasterUri();

  logger.info(`Connecting to Master DB: ${config.mongo.masterDbName}`);

  const connection = await mongoose.createConnection(uri, {
    ...config.mongo.options,
    maxPoolSize: 5,
  });

  // Register Master models
  connection.model('Company', require('../models/master/Company'));
  connection.model('Plan', require('../models/master/Plan'));
  connection.model('License', require('../models/master/License'));
  connection.model('SuperAdmin', require('../models/master/SuperAdmin'));
  connection.model('TenantUserIndex', require('../models/master/TenantUserIndex'));
  connection.model('ClientEmailIndex', require('../models/master/ClientEmailIndex'));
  connection.model('BlacklistedToken', require('../models/master/BlacklistedToken'));
  connection.model('CompanyCounter', require('../models/master/CompanyCounter'));
  connection.model('OtpCode', require('../models/master/OtpCode'));

  connection.on('error', (err) => {
    logger.error('Master DB connection error:', err);
  });

  connection.once('open', () => {
    logger.info('Master DB connected successfully');
  });

  return connection;
}

module.exports = { initMaster };