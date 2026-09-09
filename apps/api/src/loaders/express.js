const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morganMiddleware = require('../logs/morgan');
const { globalLimiter, mutationLimiter } = require('../middlewares/rateLimiter');
const config = require('../config');

function init({ app }) {
  // Security
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors(config.cors));
  app.use(cookieParser());

  // Response compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded files — use the same resolved absolute path as the upload middleware
  app.use('/uploads', express.static(path.join(config.upload.dir)));

  // Logging
  app.use(morganMiddleware);

  // Rate limiting — global ceiling for all /api/* reads + writes
  app.use('/api/', globalLimiter);

  // Separate bucket for mutating methods (POST/PUT/PATCH/DELETE) so that
  // rapid-fire status changes don't exhaust the read+write global budget.
  app.use('/api/', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return mutationLimiter(req, res, next);
    }
    next();
  });

  // Trust the reverse proxy hops declared by the operator (for accurate client
  // IPs in rate limiting and logs). Defaults to 0: with no proxy in front we
  // must NOT trust the spoofable X-Forwarded-For header. Set TRUST_PROXY=n to
  // match your nginx/Caddy hop count.
  app.set('trust proxy', config.trustProxy);

  return app;
}

module.exports = { init };