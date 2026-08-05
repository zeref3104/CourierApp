const ValidationException = require('../exceptions/ValidationException');

/**
 * Zod body validation middleware.
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} [source='body']
 * @param {number} [statusCode=400] - HTTP status for a failed parse. Defaults
 *   to the legacy 400; the device-token route opts into 422 (push-notifications
 *   spec: non-Expo token rejected 422) without changing other endpoints.
 */
const validate = (schema, source = 'body', statusCode = 400) => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return next(new ValidationException(details, statusCode));
    }
    req[source] = result.data;
    next();
  };
};

module.exports = validate;