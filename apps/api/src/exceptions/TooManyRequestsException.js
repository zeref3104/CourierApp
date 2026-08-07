const HttpException = require('./HttpException');

class TooManyRequestsException extends HttpException {
  constructor(message = 'Too many requests', details = null) {
    super(429, message, 'TOO_MANY_REQUESTS', details);
  }
}

module.exports = TooManyRequestsException;
