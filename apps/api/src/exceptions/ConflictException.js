const HttpException = require('./HttpException');

class ConflictException extends HttpException {
  constructor(message = 'Resource already exists', details = null) {
    super(409, message, 'CONFLICT', details);
  }
}

module.exports = ConflictException;