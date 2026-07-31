const NotFoundException = require('../exceptions/NotFoundException');

function notFound(req, res, next) {
  next(new NotFoundException('Route'));
}

module.exports = notFound;
