const crypto = require('crypto');

class TokenService {
  constructor() {
    this.blacklist = new Set();
  }

  generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  isBlacklisted(token) {
    const hashed = this.hashToken(token);
    return this.blacklist.has(hashed);
  }

  blacklist(token) {
    const hashed = this.hashToken(token);
    this.blacklist.add(hashed);
  }
}

module.exports = new TokenService();