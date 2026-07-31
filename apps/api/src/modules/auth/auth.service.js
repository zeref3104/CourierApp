const bcrypt = require('bcryptjs');
const jwtService = require('../../services/auth/jwt.service');
const tokenService = require('./token.service');
const connectionManager = require('../../services/tenant/connectionManager');
const UnauthorizedException = require('../../exceptions/UnauthorizedException');
const NotFoundException = require('../../exceptions/NotFoundException');
const { eventBus, EVENTS } = require('../../events');

class AuthService {
  async login(email, password, models, tenantSlug) {
    const user = await models.User.findOne({ email, isActive: true }).select('+password');
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account locked. Try again later.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset lockout on success
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    // Get role permissions
    const role = await models.Role.findById(user.roleId);
    const refreshToken = tokenService.generateRefreshToken();
    user.refreshToken = tokenService.hashToken(refreshToken);
    user.lastLogin = new Date();
    await user.save();

    // Generate access token
    const accessToken = jwtService.generateAccessToken({
      _id: user._id,
      email: user.email,
      role: role?.code || 'unknown',
      roleId: user.roleId,
      branchId: user.branchId,
      permissions: role?.permissions || [],
      clientId: user.clientId,
      isClient: user.isClient || false,
      tenant: tenantSlug,
    });

    eventBus.emit(EVENTS.USER_LOGIN, { userId: user._id, models });

    return {
      accessToken,
      refreshToken,
      mustChangePassword: user.mustChangePassword || false,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: role?.code,
        roleName: role?.name,
        permissions: role?.permissions,
        branchId: user.branchId,
        isClient: user.isClient,
        clientId: user.clientId,
      },
    };
  }

  async superadminLogin(email, password, masterConnection) {
    const SuperAdmin = masterConnection.model('SuperAdmin');
    const admin = await SuperAdmin.findOne({ email, isActive: true }).select('+password');
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const refreshToken = tokenService.generateRefreshToken();
    admin.refreshToken = tokenService.hashToken(refreshToken);
    admin.lastLogin = new Date();
    await admin.save();

    const accessToken = jwtService.generateAccessToken({
      _id: admin._id,
      email: admin.email,
      role: 'superadmin',
      roleId: null,
      branchId: null,
      permissions: ['*'],
      isSuperAdmin: true,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: 'superadmin',
        permissions: ['*'],
      },
    };
  }

  async refresh(refreshToken, masterConnection) {
    if (await tokenService.isBlacklisted(refreshToken, masterConnection)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const hashedToken = tokenService.hashToken(refreshToken);

    // Superadmin sessions persist on the master DB; staff/client sessions live
    // in their tenant's User collection. Resolve the superadmin path first so
    // the access token keeps isSuperAdmin:true and carries NO tenant claim.
    const admin = await this._findSuperAdminSession(hashedToken, masterConnection);
    if (admin) {
      const newRefreshToken = tokenService.generateRefreshToken();
      admin.refreshToken = tokenService.hashToken(newRefreshToken);
      await admin.save();

      const accessToken = jwtService.generateAccessToken({
        _id: admin._id,
        email: admin.email,
        role: 'superadmin',
        roleId: null,
        branchId: null,
        permissions: ['*'],
        isSuperAdmin: true,
      });

      return { accessToken, refreshToken: newRefreshToken };
    }

    const session = await this._findSession(hashedToken, masterConnection);
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { user, connection, tenantSlug } = session;

    // Rotation: revoke old, issue new
    const newRefreshToken = tokenService.generateRefreshToken();
    user.refreshToken = tokenService.hashToken(newRefreshToken);
    await user.save();

    const role = await connection.model('Role').findById(user.roleId);

    const accessToken = jwtService.generateAccessToken({
      _id: user._id,
      email: user.email,
      role: role?.code,
      roleId: user.roleId,
      branchId: user.branchId,
      permissions: role?.permissions,
      clientId: user.clientId,
      isClient: user.isClient || false,
      tenant: tenantSlug,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async _resolveTenantSlug(email, masterConnection) {
    const TenantUserIndex = masterConnection.model('TenantUserIndex');
    const index = await TenantUserIndex.findOne({ email, isActive: true });
    return index ? index.tenantSlug : null;
  }

  async _findSuperAdminSession(hashedToken, masterConnection) {
    const SuperAdmin = masterConnection.model('SuperAdmin');
    return SuperAdmin.findOne({ refreshToken: hashedToken, isActive: true }).select('+refreshToken');
  }

  async _findSession(hashedToken, masterConnection) {
    // Fast path: search already-open tenant connections (avoids opening new DB connections)
    for (const { dbName, connection } of connectionManager.listConnections()) {
      const user = await connection
        .model('User')
        .findOne({ refreshToken: hashedToken, isActive: true })
        .select('+refreshToken');
      if (user) {
        const tenantSlug = await this._resolveTenantSlug(user.email, masterConnection);
        if (tenantSlug) {
          return { user, connection, tenantSlug };
        }
      }
    }

    // Fallback: the session's tenant connection was evicted, search every active tenant
    const Company = masterConnection.model('Company');
    const companies = await Company.find({ isActive: true }).select('slug databaseName').lean();
    for (const company of companies) {
      const connection = await connectionManager.getConnection({
        id: company._id,
        slug: company.slug,
        dbName: company.databaseName,
      });
      const user = await connection
        .model('User')
        .findOne({ refreshToken: hashedToken, isActive: true })
        .select('+refreshToken');
      if (user) {
        return { user, connection, tenantSlug: company.slug };
      }
    }

    return null;
  }

  async logout(userId, refreshToken, models, masterConnection, { isSuperAdmin = false } = {}) {
    if (refreshToken) {
      await tokenService.blacklist(refreshToken, masterConnection);
    }
    if (isSuperAdmin) {
      await masterConnection.model('SuperAdmin').findByIdAndUpdate(userId, { refreshToken: null });
    } else if (models) {
      await models.User.findByIdAndUpdate(userId, { refreshToken: null });
    }
    eventBus.emit(EVENTS.USER_LOGOUT, { userId });
  }

  async changePassword(userId, currentPassword, newPassword, models) {
    const user = await models.User.findById(userId).select('+password');
    if (!user) throw new NotFoundException('User');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw new UnauthorizedException('Current password is incorrect');

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId, models) {
    const user = await models.User.findById(userId).populate('roleId', 'name code permissions');
    if (!user) throw new NotFoundException('User');
    return user;
  }
}

module.exports = new AuthService();