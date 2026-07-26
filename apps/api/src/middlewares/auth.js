const jwt = require('jsonwebtoken');
const config = require('../config');
const UnauthorizedException = require('../exceptions/UnauthorizedException');
const TenantNotFoundException = require('../exceptions/TenantNotFoundException');
const connectionManager = require('../services/tenant/connectionManager');

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
      clientId: decoded.clientId,
      tenant: decoded.tenant,
    };

    // Resolve tenant from JWT if not already resolved by tenantResolver
    if (!req.tenantModels && req.user.email && !req.user.isSuperAdmin) {
      const masterConnection = req.app.locals.masterConnection;
      if (masterConnection) {
        const TenantUserIndex = masterConnection.model('TenantUserIndex');
        const index = await TenantUserIndex.findOne({ email: req.user.email, isActive: true });
        if (index) {
          const Company = masterConnection.model('Company');
          const company = await Company.findOne({ slug: index.tenantSlug, isActive: true });
          if (company) {
            req.tenant = {
              id: company._id,
              slug: company.slug,
              dbName: company.databaseName,
              name: company.name,
              settings: company.settings,
            };
            const tenantConnection = await connectionManager.getConnection(req.tenant);
            req.tenantConnection = tenantConnection;
            req.tenantModels = {
              User: tenantConnection.model('User'),
              Role: tenantConnection.model('Role'),
              Customer: tenantConnection.model('Customer'),
              Package: tenantConnection.model('Package'),
              PackageHistory: tenantConnection.model('PackageHistory'),
              Branch: tenantConnection.model('Branch'),
              Payment: tenantConnection.model('Payment'),
              Receipt: tenantConnection.model('Receipt'),
              Delivery: tenantConnection.model('Delivery'),
              Rate: tenantConnection.model('Rate'),
              Notification: tenantConnection.model('Notification'),
              ActivityLog: tenantConnection.model('ActivityLog'),
              Setting: tenantConnection.model('Setting'),
            };
          } else {
            // Stale index — company no longer exists, clean up
            await TenantUserIndex.findByIdAndDelete(index._id);
          }
        }
      }
    }

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