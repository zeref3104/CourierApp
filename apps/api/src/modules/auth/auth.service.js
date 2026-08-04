const bcrypt = require('bcryptjs');
const jwtService = require('../../services/auth/jwt.service');
const tokenService = require('./token.service');
const connectionManager = require('../../services/tenant/connectionManager');
const UnauthorizedException = require('../../exceptions/UnauthorizedException');
const NotFoundException = require('../../exceptions/NotFoundException');
const ConflictException = require('../../exceptions/ConflictException');
const UnprocessableEntityException = require('../../exceptions/UnprocessableEntityException');
const logger = require('../../logs/logger');
const otpService = require('../../services/otp.service');
const masterNextSequence = require('../../services/master/counter.service').nextSequence;
const { generateClientCode } = require('@courier/helpers');
const { eventBus, EVENTS } = require('../../events');

/**
 * True when a Mongo session transaction is unsupported because the deployment
 * is a standalone node (design D8). withTransaction rejects with this error;
 * the register flow then falls back to sequential create + compensating delete.
 */
function isStandaloneTransactionError(err) {
  if (!err) return false;
  const message = String(err.message || '');
  return (
    message.includes('Transaction numbers are only allowed') ||
    message.toLowerCase().includes('standalone') ||
    err.code === 20 ||
    err.codeName === 'IllegalOperation'
  );
}

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

  /** Delegate registration OTP flows to the master-DB OtpService (design D5/D6). */
  async sendOtp({ email, lang, masterConnection }) {
    return otpService.sendOtp({ email, lang, masterConnection });
  }

  async verifyOtp({ email, code, masterConnection }) {
    return otpService.verifyOtp({ email, code, masterConnection });
  }

  /**
   * Self-service client registration (client-registration spec + auth-specs
   * delta §2.2, design D5/D7/D8). Creates the Customer (global {PREFIX}-{SEQ}
   * code via the master counter) and its linked isClient User atomically, then
   * auto-logs the client in by returning tokens in the body.
   *
   * Guards (in order): company active + non-suspended + valid license (404),
   * branch active + belonging to the company (404), OTP valid for the email
   * (422, single-use), email unique within the tenant (409).
   *
   * @returns {Promise<{accessToken: string, refreshToken: string, client: {id, code, name, email}}>}
   */
  async registerClient({ companyId, branchId, name, lastName, phone, document, email, password, otpCode, masterConnection }) {
    const normalizedEmail = String(email).trim().toLowerCase();

    // 1. Company must be active, non-suspended, and covered by a valid license.
    const Company = masterConnection.model('Company');
    const License = masterConnection.model('License');
    const company = await Company.findOne({ _id: companyId, isActive: true, isSuspended: { $ne: true } });
    if (!company) throw new NotFoundException('Company is not active or not found');
    if (!company.clientCodePrefix) {
      throw new NotFoundException('Company is not accepting registrations');
    }
    const license = await License.findOne({
      companyId: company._id,
      status: { $in: ['active', 'trial'] },
      endDate: { $gte: new Date() },
    });
    if (!license) throw new NotFoundException('Company license is not active');

    // 2. Resolve the tenant connection; the branch must exist, be active, and
    // belong to this company (branches live in the company's tenant DB).
    const tenantConnection = await connectionManager.getConnection({
      id: company._id,
      slug: company.slug,
      dbName: company.databaseName,
      plan: company.planId,
    });
    const models = {
      Customer: tenantConnection.model('Customer'),
      User: tenantConnection.model('User'),
      Role: tenantConnection.model('Role'),
    };
    const Branch = tenantConnection.model('Branch');
    const branch = await Branch.findOne({ _id: branchId, isActive: true });
    if (!branch) throw new NotFoundException('Branch is not active or not found');

    // 3. The submitted OTP must be valid for the email BEFORE any account is
    // created (spec: no Customer/User may exist on an OTP failure).
    const otpDoc = await this._verifyRegistrationOtp({
      email: normalizedEmail,
      code: otpCode,
      masterConnection,
    });

    // 4. Email must be unique within the tenant (409, nothing created).
    const [existingCustomer, existingUser] = await Promise.all([
      models.Customer.findOne({ email: normalizedEmail }),
      models.User.findOne({ email: normalizedEmail }),
    ]);
    if (existingCustomer || existingUser) {
      throw new ConflictException('Email already registered in this company');
    }

    // 5. Canonical client role (design D7). Provisioned at company creation;
    // self-heal legacy tenants that predate the role.
    let clientRole = await models.Role.findOne({ code: 'client' });
    if (!clientRole) {
      clientRole = await models.Role.create({
        code: 'client',
        name: 'Cliente',
        description: 'Self-service client',
        permissions: [],
        isSystem: true,
      });
    }

    // 6. Mint the global code and create Customer + isClient User atomically.
    const seq = await masterNextSequence(masterConnection, company._id);
    const code = generateClientCode(company.clientCodePrefix, seq);
    const customerData = {
      code,
      name,
      lastName,
      phone,
      email: normalizedEmail,
      branchId: branch._id,
      isActive: true,
    };
    if (document) customerData.document = document;
    const userData = {
      name: `${name} ${lastName}`.trim(),
      email: normalizedEmail,
      password,
      phone,
      roleId: clientRole._id,
      branchId: branch._id,
      isActive: true,
      isClient: true,
    };

    const { customer, user } = await this._createClientPair(models, customerData, userData);

    // 7. Consume the OTP — single-use, never reusable after registration.
    otpDoc.consumedAt = new Date();
    await otpDoc.save();

    // 8. Auto-login: issue client tokens in the existing login shape (design
    // contract returns them in the body for React Native).
    const refreshToken = tokenService.generateRefreshToken();
    user.refreshToken = tokenService.hashToken(refreshToken);
    await user.save();

    const accessToken = jwtService.generateAccessToken({
      _id: user._id,
      email: user.email,
      role: clientRole.code,
      roleId: user.roleId,
      branchId: user.branchId,
      permissions: clientRole.permissions || [],
      clientId: user.clientId,
      isClient: true,
      tenant: company.slug,
    });

    eventBus.emit(EVENTS.USER_LOGIN, { userId: user._id, models });

    return {
      accessToken,
      refreshToken,
      client: {
        id: customer._id,
        code: customer.code,
        name: customer.name,
        email: customer.email,
      },
    };
  }

  /**
   * Validate a registration OTP for an email. Enforces expiry, the 5-attempt
   * lockout, and single-use (consumedAt). A mismatched code increments the
   * attempt counter; a matching code marks verifiedAt but is NOT consumed yet —
   * consumption happens only after the Customer/User pair persists, so a later
   * failure (e.g. duplicate email 409) leaves the code reusable.
   * @returns {Promise<Object>} the OtpCode document (for the caller to consume)
   */
  async _verifyRegistrationOtp({ email, code, masterConnection }) {
    const OtpCode = masterConnection.model('OtpCode');
    const doc = await OtpCode.findOne({ key: otpService.buildKey(email) });
    if (!doc) throw new UnprocessableEntityException('OTP not found or expired');
    if (doc.expiresAt.getTime() < Date.now()) {
      throw new UnprocessableEntityException('OTP expired');
    }
    if (doc.consumedAt) {
      throw new UnprocessableEntityException('OTP already used');
    }
    if (doc.attempts >= otpService.OTP_MAX_ATTEMPTS) {
      throw new UnprocessableEntityException('OTP invalidated after too many attempts');
    }

    if (otpService.sha256(code) !== doc.codeHash) {
      doc.attempts += 1;
      await doc.save();
      throw new UnprocessableEntityException('Invalid OTP code');
    }

    if (!doc.verifiedAt) doc.verifiedAt = new Date();
    return doc;
  }

  /**
   * Create the Customer + isClient User pair atomically (design D8):
   * - When the deployment supports sessions (replica set): one transaction.
   * - On a standalone node withTransaction rejects; fall back to sequential
   *   create + compensating delete of the Customer if the User fails, so no
   *   partial account ever persists.
   */
  async _createClientPair(models, customerData, userData) {
    const { Customer, User } = models;
    const tenantConnection = Customer.db;

    let session = null;
    try {
      session = await tenantConnection.startSession();
    } catch {
      session = null;
    }

    if (session) {
      try {
        let customer;
        let user;
        await session.withTransaction(async () => {
          customer = new Customer(customerData);
          await customer.save({ session });
          user = new User({ ...userData, clientId: customer._id });
          await user.save({ session });
        });
        return { customer, user };
      } catch (err) {
        if (!isStandaloneTransactionError(err)) throw err;
        logger.warn('[AUTH] Transactions unsupported (standalone MongoDB) — falling back to compensating rollback (design D8)');
      } finally {
        await session.endSession().catch(() => {});
      }
    }

    // Standalone fallback: sequential create + compensating delete.
    const customer = await Customer.create(customerData);
    try {
      const user = await User.create({ ...userData, clientId: customer._id });
      return { customer, user };
    } catch (err) {
      await Customer.deleteOne({ _id: customer._id }).catch(() => {});
      throw err;
    }
  }
}

module.exports = new AuthService();