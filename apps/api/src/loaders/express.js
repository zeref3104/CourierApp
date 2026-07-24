const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morganMiddleware = require('../logs/morgan');
const { globalLimiter } = require('../middlewares/rateLimiter');
const config = require('../config');

function init({ app }) {
  // Security
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors(config.cors));
  app.use(cookieParser());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging
  app.use(morganMiddleware);

  // Rate limiting
  app.use('/api/', globalLimiter);

  // Trust proxy for rate limiting behind nginx
  app.set('trust proxy', 1);

  return app;
}

module.exports = { init };