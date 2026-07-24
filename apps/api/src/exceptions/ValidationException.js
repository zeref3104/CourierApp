const HttpException = require('./HttpException');

class ValidationException extends HttpException {
  constructor(details) {
    super(400, 'Validation failed', 'VALIDATION_ERROR', details);
  }
}

module.exports = ValidationException;