const mongoose = require('mongoose');
const connectionManager = require('../services/tenant/connectionManager');
const TenantNotFoundException = require('../exceptions/TenantNotFoundException');

async function tenantResolver(req, res, next) {
  try {
    // Skip tenant resolution for SuperAdmin routes
    if (req.path.startsWith('/api/v1/superadmin')) {
      return next();
    }

    // Extract tenant slug from subdomain or header
    const host = req.headers.host || '';
    const slugFromSubdomain = host.split('.')[0];
    const tenantSlug = req.headers['x-tenant-slug'] || slugFromSubdomain;

    if (!tenantSlug || tenantSlug === 'localhost' || tenantSlug === 'www') {
      // Dev fallback: allow single-tenant mode
      const devSlug = process.env.DEV_TENANT_SLUG;
      if (process.env.NODE_ENV === 'development' && devSlug) {
        req.tenantSlug = devSlug;
      } else {
        return next(new TenantNotFoundException(tenantSlug || 'unknown'));
      }
    }

    const slug = req.tenantSlug || tenantSlug;

    // Get Master DB connection from app locals
    const masterConnection = req.app.locals.masterConnection;
    if (!masterConnection) {
      return next(new Error('Master DB not initialized'));
    }

    const Company = masterConnection.model('Company');
    const License = masterConnection.model('License');

    // Find company
    const company = await Company.findOne({ slug, isActive: true }).populate('planId');
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
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = tenantResolver;