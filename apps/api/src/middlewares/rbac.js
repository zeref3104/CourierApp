const ForbiddenException = require('../exceptions/ForbiddenException');

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenException('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenException('Insufficient role permissions'));
    }
    next();
  };
}

function can(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenException('Authentication required'));
    }
    // SuperAdmin bypass
    if (req.user.role === 'superadmin') return next();
    // Admin has all permissions
    if (req.user.role === 'admin') return next();
    // Check granular permission
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return next(new ForbiddenException(`Missing permission: ${permission}`));
    }
    next();
  };
}

module.exports = { authorize, can };