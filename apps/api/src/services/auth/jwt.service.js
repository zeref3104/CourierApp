const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config');

class JwtService {
  generateAccessToken(user) {
    return jwt.sign(
      {
        sub: user._id,
        email: user.email,
        role: user.role,
        roleId: user.roleId,
        branchId: user.branchId,
        permissions: user.permissions,
        isClient: user.isClient || false,
        tenant: user.tenant,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiresIn }
    );
  }

  generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  verifyAccessToken(token) {
    return jwt.verify(token, config.jwt.secret);
  }

  decodeToken(token) {
    return jwt.decode(token);
  }
}

module.exports = new JwtService();