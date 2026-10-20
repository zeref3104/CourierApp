const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
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

  try {
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

    // lazyConnect only opens the socket on the first command; with
    // enableOfflineQueue disabled that first command would fail. Connect now
    // (best-effort) so the store is ready before traffic arrives.
    client.connect().catch((err) => {
      logger.error('rate-limit redis connect failed (falling back per request):', err.message);
    });

    return new RedisStore({
      prefix: 'rl:',
      // rate-limit-redis v4 requires the command transport explicitly.
      sendCommand: (...args) => client.call(...args),
    });
  } catch (err) {
    logger.error('rate-limit: Redis store unavailable, using in-memory store:', err.message);
    return undefined;
  }
}

const store = resolveStore();

// Guard against an operator copying an old, very low ceiling from a previous
// deployment: at 100 req/15 min a single admin exhausts the bucket just by
// navigating and changing a few package statuses, and the resulting 429s look
// exactly like an application outage.
if (config.rateLimit.max < 300) {
  logger.warn(
    `rate-limit: RATE_LIMIT_MAX=${config.rateLimit.max} per window is below the ` +
    `recommended floor (1000); normal package work can exhaust it`
  );
}
if (config.rateLimit.mutationMax < 60) {
  logger.warn(
    `rate-limit: RATE_LIMIT_MUTATION_MAX=${config.rateLimit.mutationMax} per window ` +
    `is below the recommended floor (300); bulk status updates will be throttled`
  );
}

// Fail-open when the external store (Redis) errors: an observability/limiter
// outage must never take the whole API down. In-memory stores never error.
const PASS_ON_STORE_ERROR = true;

/**
 * CORS preflights are browser plumbing, not application traffic: a single
 * cross-origin API call produces an OPTIONS request first. Counting them
 * halved the real request budget AND, when the limiter answered 429 to an
 * OPTIONS request, the browser surfaced it as an opaque CORS/network failure
 * with no actionable message. Never count them.
 */
function skipPreflight(req) {
  return req.method === 'OPTIONS';
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Bucket key for an authenticated request.
 *
 * The limiter is mounted before the auth middleware, so `req.user` is not
 * available yet. Decode the bearer token here instead: the signature is
 * verified (HMAC — microseconds) before trusting `sub`, so a client cannot
 * forge a brand-new key to reset its own window. Requests with a missing,
 * invalid, or expired token fall back to the IP bucket; they will be rejected
 * by the auth middleware anyway.
 *
 * Keying by user (instead of IP alone) is what keeps an office behind one NAT
 * from sharing a single budget: one operator working through packages no
 * longer exhausts the bucket for every colleague.
 */
function principalKey(req) {
  const header = req.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), config.jwt.secret);
      if (decoded?.sub) return `user:${decoded.sub}`;
    } catch {
      // Invalid/expired token — fall through to the IP bucket.
    }
  }
  return `ip:${clientIp(req)}`;
}

/**
 * Log the block so operators can tell "the app is broken" apart from "the app
 * is being rate limited" without guessing. The client still gets the JSON body.
 */
function logBlock(bucket) {
  return (req, res, next, options) => {
    // express-rate-limit sets Retry-After before calling the handler.
    const retryAfter = res.getHeader('Retry-After') || Math.ceil((options.windowMs || 0) / 1000);
    logger.warn(
      `rate-limit: ${bucket} blocked ${req.method} ${req.originalUrl} (retry after ${retryAfter}s)`
    );
    res.status(options.statusCode).send(options.message);
  };
}

/**
 * Global limiter — generous ceiling for ALL /api/* routes.
 * Prevents brute-force / DDoS while not blocking normal admin workflows
 * (e.g. processing a batch of packages back to back).
 */
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  store,
  passOnStoreError: PASS_ON_STORE_ERROR,
  skip: skipPreflight,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: principalKey,
  handler: logBlock('global'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests, please try again later',
    },
  },
});

/**
 * Mutation limiter — separate bucket for write operations (POST, PUT, PATCH,
 * DELETE). Prevents rapid-fire mutations from exhausting the global bucket
 * while keeping reads unaffected.
 */
const mutationLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.mutationMax,
  store,
  passOnStoreError: PASS_ON_STORE_ERROR,
  skip: skipPreflight,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `mut:${principalKey(req)}`,
  handler: logBlock('mutation'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many write operations, please slow down',
    },
  },
});

/**
 * Auth limiter — strict ceiling for credential endpoints (login / password
 * recovery). Brute-forcing a password must stay expensive.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  store,
  passOnStoreError: PASS_ON_STORE_ERROR,
  skip: skipPreflight,
  standardHeaders: true,
  legacyHeaders: false,
  handler: logBlock('auth'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many login attempts, please try again later',
    },
  },
});

/**
 * Refresh limiter — separate bucket for session rotation. This is an
 * authenticated continuation of an existing session, not a password guess, so
 * it must not consume (or be blocked by) the strict auth bucket. Sharing it
 * was one of the paths that left a user unable to work for a full window.
 */
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.refreshMax,
  store,
  passOnStoreError: PASS_ON_STORE_ERROR,
  skip: skipPreflight,
  standardHeaders: true,
  legacyHeaders: false,
  handler: logBlock('refresh'),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many session refreshes, please try again later',
    },
  },
});

module.exports = { globalLimiter, mutationLimiter, authLimiter, refreshLimiter };
