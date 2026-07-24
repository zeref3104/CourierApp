const HttpException = require('./HttpException');

class ForbiddenException extends HttpException {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'FORBIDDEN');
  }
}

module.exports = ForbiddenException;