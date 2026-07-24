const HttpException = require('./HttpException');

class UnauthorizedException extends HttpException {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED');
  }
}

module.exports = UnauthorizedException;