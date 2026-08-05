const HttpException = require('./HttpException');

class ValidationException extends HttpException {
  constructor(details, statusCode = 400) {
    super(statusCode, 'Validation failed', 'VALIDATION_ERROR', details);
  }
}

module.exports = ValidationException;