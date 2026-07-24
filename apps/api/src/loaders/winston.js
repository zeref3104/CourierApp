const logger = require('../logs/logger');

function init() {
  logger.info('Logger initialized');
  return logger;
}

module.exports = { init };