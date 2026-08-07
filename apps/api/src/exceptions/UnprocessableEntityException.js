const HttpException = require('./HttpException');

class UnprocessableEntityException extends HttpException {
  constructor(message = 'Unprocessable entity', details = null) {
    super(422, message, 'UNPROCESSABLE_ENTITY', details);
  }
}

module.exports = UnprocessableEntityException;
