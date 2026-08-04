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

  /**
   * Replay-aware rotation (design D10): rotate a user's refresh token while
   * keeping the outgoing hash as `previousRefreshTokenHash`, so a reused
   * (replayed) token can be detected on the next submit.
   * @param {Object} user - the auth user/superadmin doc (mutated then saved by caller)
   * @param {string} newToken - the freshly generated refresh token (raw)
   */
  rotate(user, newToken) {
    user.previousRefreshTokenHash = user.refreshToken || null;
    user.refreshToken = this.hashToken(newToken);
  }

  /**
   * True when the submitted hashed token matches the PREVIOUS (rotated-out)
   * refresh token — i.e. an old token was reused after a rotation (replay).
   * @param {Object} user - the auth user/superadmin doc
   * @param {string} hashedToken - sha256 of the submitted refresh token
   */
  isReplay(user, hashedToken) {
    return !!user.previousRefreshTokenHash && user.previousRefreshTokenHash === hashedToken;
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
