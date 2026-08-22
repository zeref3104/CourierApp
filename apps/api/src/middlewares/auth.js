const jwt = require('jsonwebtoken');
const config = require('../config');
const UnauthorizedException = require('../exceptions/UnauthorizedException');
const ForbiddenException = require('../exceptions/ForbiddenException');
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
      isSuperAdmin: decoded.isSuperAdmin || false,
      tenant: decoded.tenant,
    };

    // Resolve tenant from JWT if not already resolved by tenantResolver.
    // Staff emails live in TenantUserIndex; client emails live in
    // ClientEmailIndex — both paths must be tried so that /client/*
    // endpoints get a valid req.tenantModels.
    if (!req.tenantModels && req.user.email && !req.user.isSuperAdmin) {
      const masterConnection = req.app.locals.masterConnection;
      if (masterConnection) {
        const Company = masterConnection.model('Company');
        let company = null;

        // 1. Try staff path: TenantUserIndex
        const TenantUserIndex = masterConnection.model('TenantUserIndex');
        const staffIndex = await TenantUserIndex.findOne({ email: req.user.email, isActive: true });
        if (staffIndex) {
          company = await Company.findOne({ slug: staffIndex.tenantSlug, isActive: true, isSuspended: { $ne: true } });
          if (!company) {
            // Stale index — company no longer exists, clean up
            await TenantUserIndex.findByIdAndDelete(staffIndex._id);
          }
        }

        // 2. Fallback for client users: ClientEmailIndex
        if (!company && req.user.isClient) {
          const ClientEmailIndex = masterConnection.model('ClientEmailIndex');
          const clientIndex = await ClientEmailIndex.findOne({ email: req.user.email, isActive: true });
          if (clientIndex) {
            company = await Company.findById(clientIndex.companyId);
            if (company && (!company.isActive || company.isSuspended)) {
              company = null; // locked company — do not resolve
            }
          }
        }

        // 3. Final fallback: JWT tenant claim (belt-and-suspenders for clients
        //    whose index entries may have been cleaned up)
        if (!company && req.user.tenant) {
          company = await Company.findOne({ slug: req.user.tenant, isActive: true, isSuspended: { $ne: true } });
        }

        if (company) {
          req.tenantSlug = company.slug;
          req.tenant = {
            id: company._id,
            slug: company.slug,
            dbName: company.databaseName,
            name: company.name,
            settings: company.settings,
            clientCodePrefix: company.clientCodePrefix,
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
            Counter: tenantConnection.model('Counter'),
          };
        }
      }
    }

    // Cross-tenant spoofing guard: the JWT was issued for req.user.tenant; the
    // request must be targeting the same tenant (resolved by tenantResolver).
    if (req.user.tenant && req.tenantSlug && req.user.tenant !== req.tenantSlug) {
      return next(new ForbiddenException('Tenant mismatch'));
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