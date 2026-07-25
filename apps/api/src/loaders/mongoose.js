const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../logs/logger');

async function initMaster() {
  const uri = `${config.mongo.uri}/${config.mongo.masterDbName}`;

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

  connection.on('error', (err) => {
    logger.error('Master DB connection error:', err);
  });

  connection.once('open', () => {
    logger.info('Master DB connected successfully');
  });

  return connection;
}

module.exports = { initMaster };