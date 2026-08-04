const mongoose = require('mongoose');
const connectionManager = require('../services/tenant/connectionManager');
const TenantNotFoundException = require('../exceptions/TenantNotFoundException');

// Public routes that don't require tenant resolution
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/client/login',
  '/auth/refresh',
  '/auth/password',
  '/auth/superadmin/login',
  '/superadmin/login',
];

async function tenantResolver(req, res, next) {
  try {
    // Skip tenant resolution for public routes
    if (PUBLIC_ROUTES.some(route => req.path.startsWith(route))) {
      return next();
    }

    // Skip tenant resolution for SuperAdmin routes
    if (req.path.startsWith('/superadmin')) {
      return next();
    }

    // Extract tenant slug from subdomain or header
    const host = (req.headers.host || '').split(':')[0]; // strip port
    const slugFromSubdomain = host.split('.')[0];
    const tenantSlug = req.headers['x-tenant-slug'] || slugFromSubdomain;

    if (!tenantSlug || tenantSlug === 'localhost' || tenantSlug === 'www') {
      if (process.env.NODE_ENV === 'development') {
        // In development, skip tenant resolution — auth middleware resolves from JWT
        return next();
      }
      return next(new TenantNotFoundException(tenantSlug || 'unknown'));
    }

    const slug = req.tenantSlug || tenantSlug;

    // Store resolved slug so downstream middlewares can verify JWT tenant consistency
    req.tenantSlug = slug;

    // Get Master DB connection from app locals
    const masterConnection = req.app.locals.masterConnection;
    if (!masterConnection) {
      return next(new Error('Master DB not initialized'));
    }

    const Company = masterConnection.model('Company');
    const License = masterConnection.model('License');

    // Find company (suspended companies must not resolve as active tenants)
    const company = await Company.findOne({ slug, isActive: true, isSuspended: { $ne: true } }).populate('planId');
    if (!company) {
      return next(new TenantNotFoundException(slug));
    }

    // Validate license
    const license = await License.findOne({
      companyId: company._id,
      status: { $in: ['active', 'trial'] },
      endDate: { $gte: new Date() },
    });

    if (!license) {
      return next(new TenantNotFoundException(slug, 'License expired or inactive'));
    }

    // Attach tenant context
    req.tenant = {
      id: company._id,
      slug: company.slug,
      dbName: company.databaseName,
      name: company.name,
      logo: company.logo,
      plan: company.planId,
      license,
      settings: company.settings,
      clientCodePrefix: company.clientCodePrefix,
    };

    // Get tenant DB connection
    const tenantConnection = await connectionManager.getConnection(req.tenant);
    req.tenantConnection = tenantConnection;

    // Load models on request for convenience
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

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = tenantResolver;