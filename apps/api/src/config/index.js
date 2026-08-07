require('dotenv').config();

const requiredSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = requiredSecrets.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `FATAL: Missing required environment variables: ${missing.join(', ')}. ` +
    'Set them in .env or environment before starting the server.'
  );
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    masterDbName: process.env.MASTER_DB_NAME || 'master_db',
    options: {
      maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE, 10) || 10,
      serverSelectionTimeoutMS: 5000,
    },
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    redisUrl: process.env.REDIS_URL || '',
  },

  // How many reverse-proxy hops precede the app (nginx, etc.). When set to a
  // positive number, the rate limiter honors X-Forwarded-For. Leave unset/0
  // for direct exposure so the header cannot be spoofed to bypass limits.
  trustProxy: process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY, 10) : 0,

  cors: {
    // Comma-separated list of allowed origins (dev + prod). The `cors` and
    // socket.io middlewares echo the matching request origin when given an
    // array; a bare string would allow exactly one origin.
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : 'http://localhost:5173',
    credentials: true,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  tenant: {
    maxConnections: 100,
    connectionTTL: 30 * 60 * 1000,
    defaultPoolSize: 10,
  },
};

module.exports = config;