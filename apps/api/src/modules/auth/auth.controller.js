const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');
const UnauthorizedException = require('../../exceptions/UnauthorizedException');
const TenantNotFoundException = require('../../exceptions/TenantNotFoundException');
const logger = require('../../logs/logger');

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

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return apiResponse.success(res, {
        accessToken: result.accessToken,
        mustChangePassword: false,
        user: result.user,
      }, 'SuperAdmin login successful');
    }

    // 2. Normal user login — resolve tenant
    let models = req.tenantModels;
    if (!models) {
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
      const company = await Company.findOne({ slug: tenantSlug, isActive: true }).populate('planId');
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
      models = {
        User: tenantConnection.model('User'),
        Role: tenantConnection.model('Role'),
      };
    }

    const result = await authService.login(email, password, models);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

    // Normal client login
    let models = req.tenantModels;
    if (!models) {
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
      const company = await Company.findOne({ slug: tenantSlug, isActive: true }).populate('planId');
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
      models = {
        User: tenantConnection.model('User'),
        Role: tenantConnection.model('Role'),
      };
    }

    const result = await authService.login(email, password, models);

    if (!result.user.isClient) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/superadmin',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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
    const models = req.tenantModels;
    const result = await authService.refresh(refreshToken, models);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    apiResponse.success(res, { accessToken: result.accessToken }, 'Token refreshed');
  }),

  logout: asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    const models = req.tenantModels;
    await authService.logout(req.user._id, refreshToken, models);
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
    const masterConnection = req.app.locals.masterConnection;

    // Resolve tenant from email (same as login)
    let models = req.tenantModels;
    if (!models) {
      const TenantUserIndex = masterConnection.model('TenantUserIndex');
      const index = await TenantUserIndex.findOne({ email: req.user.email, isActive: true });
      if (!index) {
        throw new TenantNotFoundException('User tenant not found');
      }
      const Company = masterConnection.model('Company');
      const company = await Company.findOne({ slug: index.tenantSlug, isActive: true });
      if (!company) throw new TenantNotFoundException(index.tenantSlug);
      const connectionManager = require('../../services/tenant/connectionManager');
      const tenantConnection = await connectionManager.getConnection({
        id: company._id,
        slug: company.slug,
        dbName: company.databaseName,
      });
      models = { User: tenantConnection.model('User') };
    }

    const result = await authService.changePassword(req.user._id, currentPassword, newPassword, models);
    apiResponse.success(res, result, 'Password changed successfully');
  }),
};

module.exports = authController;