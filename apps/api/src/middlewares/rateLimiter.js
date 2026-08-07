const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../logs/logger');

/**
 * Build a rate-limit store. When REDIS_URL is configured (production /
 * multi-instance), use a Redis-backed store that survives restarts and is
 * shared across instances. Otherwise fall back to the in-memory store, which
 * resets on restart and is local to one process — acceptable for dev/single
 * instance only.
 */
function resolveStore() {
  const { redisUrl } = config.rateLimit;
  if (!redisUrl) {
    logger.warn('rate-limit: REDIS_URL not set — using in-memory store (limits reset on restart, not shared across instances)');
    return undefined;
  }

  const Redis = require('ioredis');
  const { RedisStore } = require('rate-limit-redis');

  const client = new Redis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  client.on('error', (err) => {
    logger.error('rate-limit redis client error:', err.message);
  });

  return new RedisStore({
    // Default sendCommand: (args) => client.sendCommand(args),
    prefix: 'rl:',
  });
}

const store = resolveStore();

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  store,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests, please try again later',
    },
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  store,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many login attempts, please try again later',
    },
  },
});

module.exports = { globalLimiter, authLimiter };