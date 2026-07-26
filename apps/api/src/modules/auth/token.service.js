const crypto = require('crypto');

class TokenService {
  constructor() {
    // In-memory cache for fast checks (survives alongside MongoDB)
    this.blacklistCache = new Set();
  }

  generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async isBlacklisted(token, masterConnection) {
    const hashed = this.hashToken(token);

    // Fast path: check in-memory cache
    if (this.blacklistCache.has(hashed)) return true;

    // Persistence path: check MongoDB (if connection available)
    if (masterConnection) {
      const BlacklistedToken = masterConnection.model('BlacklistedToken');
      const found = await BlacklistedToken.findOne({ hashedToken: hashed });
      if (found) {
        this.blacklistCache.add(hashed); // warm cache
        return true;
      }
    }

    return false;
  }

  async blacklist(token, masterConnection) {
    const hashed = this.hashToken(token);
    this.blacklistCache.add(hashed);

    if (masterConnection) {
      try {
        const BlacklistedToken = masterConnection.model('BlacklistedToken');
        // Tokens expire in 7 days (matches JWT_REFRESH_EXPIRES_IN default)
        await BlacklistedToken.create({
          hashedToken: hashed,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
      } catch (err) {
        // Ignore duplicate key errors (already blacklisted)
        if (err.code !== 11000) throw err;
      }
    }
  }
}

module.exports = new TokenService();
