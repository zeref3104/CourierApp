const ValidationException = require('../exceptions/ValidationException');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return next(new ValidationException(details));
    }
    req[source] = result.data;
    next();
  };
};

module.exports = validate;