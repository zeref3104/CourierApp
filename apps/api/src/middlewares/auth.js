const jwt = require('jsonwebtoken');
const config = require('../config');
const UnauthorizedException = require('../exceptions/UnauthorizedException');

async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    // Attach user to request
    req.user = {
      _id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      roleId: decoded.roleId,
      branchId: decoded.branchId,
      permissions: decoded.permissions || [],
      isClient: decoded.isClient || false,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedException('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedException('Token expired'));
    }
    next(error);
  }
}

module.exports = auth;