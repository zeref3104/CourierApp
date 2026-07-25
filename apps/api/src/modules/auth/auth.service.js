const bcrypt = require('bcryptjs');
const jwtService = require('../../services/auth/jwt.service');
const tokenService = require('./token.service');
const UnauthorizedException = require('../../exceptions/UnauthorizedException');
const NotFoundException = require('../../exceptions/NotFoundException');
const { eventBus, EVENTS } = require('../../events');

class AuthService {
  async login(email, password, models) {
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
      tenant: user.isClient ? undefined : undefined,
    });

    eventBus.emit(EVENTS.USER_LOGIN, { userId: user._id });

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
      },
    };
  }

  async superadminLogin(email, password, masterConnection) {
    const SuperAdmin = masterConnection.model('SuperAdmin');
    const admin = await SuperAdmin.findOne({ email, isActive: true }).select('+password');
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

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

    const refreshToken = tokenService.generateRefreshToken();

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

  async refresh(refreshToken, models) {
    if (tokenService.isBlacklisted(refreshToken)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const hashedToken = tokenService.hashToken(refreshToken);
    const user = await models.User.findOne({
      refreshToken: hashedToken,
      isActive: true,
    });

    if (!user) throw new UnauthorizedException('Invalid refresh token');

    // Rotation: revoke old, issue new
    const newRefreshToken = tokenService.generateRefreshToken();
    user.refreshToken = tokenService.hashToken(newRefreshToken);
    await user.save();

    const role = await models.Role.findById(user.roleId);
    const accessToken = jwtService.generateAccessToken({
      _id: user._id,
      email: user.email,
      role: role?.code,
      roleId: user.roleId,
      branchId: user.branchId,
      permissions: role?.permissions,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId, refreshToken, models) {
    if (refreshToken) {
      tokenService.blacklist(refreshToken);
    }
    await models.User.findByIdAndUpdate(userId, { refreshToken: null });
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