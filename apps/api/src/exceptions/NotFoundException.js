const HttpException = require('./HttpException');

class NotFoundException extends HttpException {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

module.exports = NotFoundException;