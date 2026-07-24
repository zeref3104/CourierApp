const logger = require('../logs/logger');
const HttpException = require('../exceptions/HttpException');

function errorHandler(err, req, res, next) {
  if (err instanceof HttpException) {
    logger.warn(`${err.code}: ${err.message}`, {
      path: req.path,
      method: req.method,
      tenant: req.tenant?.slug,
      userId: req.user?._id,
      details: err.details,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    logger.warn('Mongoose validation error', {
      path: req.path,
      errors: err.errors,
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Database validation failed',
        details: Object.entries(err.errors).map(([field, e]) => ({
          field,
          message: e.message,
        })),
      },
    });
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    logger.warn('Duplicate key error', {
      path: req.path,
      keyValue: err.keyValue,
    });

    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ERROR',
        message: 'Resource already exists',
        details: err.keyValue,
      },
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid ${err.path}: ${err.value}`,
      },
    });
  }

  // Unknown error
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    tenant: req.tenant?.slug,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
}

module.exports = errorHandler;