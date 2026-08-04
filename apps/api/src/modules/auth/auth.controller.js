const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const UnauthorizedException = require('../../exceptions/UnauthorizedException');
const TenantNotFoundException = require('../../exceptions/TenantNotFoundException');
const logger = require('../../logs/logger');

/**
 * Resolve tenant models from request context or email.
 * Shared helper to avoid duplication across login/clientLogin/changePassword.
 */
async function resolveTenantModels(req, email) {
  // Already resolved by tenantResolver middleware
  if (req.tenantModels) return req.tenantModels;

  const masterConnection = req.app.locals.masterConnection;
  let tenantSlug = req.headers['x-tenant-slug'];

  // Auto-resolve tenant from email index if no slug provided
  if (!tenantSlug) {
    const TenantUserIndex = masterConnection.model('TenantUserIndex');
    const index = await TenantUserIndex.findOne({ email, isActive: true });
    if (index) {
      tenantSlug = index.tenantSlug;
    }
  }

  if (!tenantSlug) {
    throw new TenantNotFoundException('Tenant slug required (x-tenant-slug header)');
  }

  const Company = masterConnection.model('Company');
  const License = masterConnection.model('License');
  const company = await Company.findOne({ slug: tenantSlug, isActive: true, isSuspended: { $ne: true } }).populate('planId');
  if (!company) throw new TenantNotFoundException(tenantSlug);

  const license = await License.findOne({
    companyId: company._id,
    status: { $in: ['active', 'trial'] },
    endDate: { $gte: new Date() },
  });
  if (!license) throw new TenantNotFoundException(tenantSlug, 'License expired or inactive');

  const connectionManager = require('../../services/tenant/connectionManager');
  const tenantConnection = await connectionManager.getConnection({
    id: company._id,
    slug: company.slug,
    dbName: company.databaseName,
    plan: company.planId,
  });

  // Attach tenant context to req so downstream middlewares/handlers can use it
  req.tenant = {
    id: company._id,
    slug: company.slug,
    dbName: company.databaseName,
    name: company.name,
    plan: company.planId,
    settings: company.settings,
  };
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

  return req.tenantModels;
}

/** Set refresh token cookie on response */
function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const authController = {
  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const masterConnection = req.app.locals.masterConnection;

    // 1. Check if it's a SuperAdmin (exists in master DB)
    const SuperAdmin = masterConnection.model('SuperAdmin');
    const superAdmin = await SuperAdmin.findOne({ email, isActive: true }).select('+password');

    if (superAdmin) {
      logger.info('[AUTH] SuperAdmin detected, using master DB login');
      const result = await authService.superadminLogin(email, password, masterConnection);

      setRefreshCookie(res, result.refreshToken);

      return apiResponse.success(res, {
        accessToken: result.accessToken,
        mustChangePassword: false,
        user: result.user,
      }, 'SuperAdmin login successful');
    }

    // 2. Normal user login — resolve tenant
    const models = await resolveTenantModels(req, email);
    const result = await authService.login(email, password, models, req.tenant?.slug);

    setRefreshCookie(res, result.refreshToken);

    apiResponse.success(res, {
      accessToken: result.accessToken,
      mustChangePassword: result.mustChangePassword,
      user: result.user,
    }, 'Login successful');
  }),

  clientLogin: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const masterConnection = req.app.locals.masterConnection;

    // SuperAdmin bypass for client login
    const SuperAdmin = masterConnection.model('SuperAdmin');
    const superAdmin = await SuperAdmin.findOne({ email, isActive: true }).select('+password');
    if (superAdmin) {
      throw new UnauthorizedException('SuperAdmin cannot login as client');
    }

    // Normal client login — resolve tenant
    const models = await resolveTenantModels(req, email);
    const result = await authService.login(email, password, models, req.tenant?.slug);

    if (!result.user.isClient) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    setRefreshCookie(res, result.refreshToken);

    apiResponse.success(res, {
      accessToken: result.accessToken,
      mustChangePassword: result.mustChangePassword,
      user: result.user,
    }, 'Login successful');
  }),

  superadminLogin: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const masterConnection = req.app.locals.masterConnection;
    const result = await authService.superadminLogin(email, password, masterConnection);

    setRefreshCookie(res, result.refreshToken);

    apiResponse.success(res, {
      accessToken: result.accessToken,
      user: result.user,
    }, 'SuperAdmin login successful');
  }),

  refresh: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }
    const masterConnection = req.app.locals.masterConnection;
    const result = await authService.refresh(refreshToken, masterConnection);

    setRefreshCookie(res, result.refreshToken);

    apiResponse.success(res, { accessToken: result.accessToken }, 'Token refreshed');
  }),

  logout: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    const masterConnection = req.app.locals.masterConnection;
    await authService.logout(req.user._id, refreshToken, req.tenantModels, masterConnection, {
      isSuperAdmin: req.user.isSuperAdmin,
    });
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    apiResponse.success(res, null, 'Logged out successfully');
  }),

  me: asyncHandler(async (req, res) => {
    const models = req.tenantModels;
    const user = await authService.getProfile(req.user._id, models);
    apiResponse.success(res, user);
  }),

  changePassword: asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const models = await resolveTenantModels(req, req.user.email);
    const result = await authService.changePassword(req.user._id, currentPassword, newPassword, models);
    apiResponse.success(res, result, 'Password changed successfully');
  }),

  otpSend: asyncHandler(async (req, res) => {
    const { email, lang } = req.body;
    const masterConnection = req.app.locals.masterConnection;

    const result = await authService.sendOtp({ email, lang, masterConnection });
    apiResponse.success(res, result, 'OTP sent successfully');
  }),

  otpVerify: asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const masterConnection = req.app.locals.masterConnection;

    const result = await authService.verifyOtp({ email, code, masterConnection });
    apiResponse.success(res, result, 'OTP verified');
  }),
};

module.exports = authController;
