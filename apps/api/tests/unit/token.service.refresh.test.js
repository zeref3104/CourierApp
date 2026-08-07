/**
 * Unit tests for tokenService rotation helpers (client-mobile-app task 3.4,
 * design D10). These are pure helpers that implement replay-aware rotation:
 * - rotate(user, newToken): moves the current refreshToken hash into
 *   previousRefreshTokenHash and stores the new token's hash (so a reused old
 *   token can be detected later).
 * - isReplay(user, hashedToken): true when the submitted hash matches the
 *   PREVIOUS (rotated-out) token — NOT the current one.
 */
const tokenService = require('../../src/modules/auth/token.service');

const sha256 = (value) => require('crypto').createHash('sha256').update(value).digest('hex');

describe('tokenService.rotate', () => {
  test('moves the current refresh token into previous and stores the new hash', () => {
    const user = { refreshToken: sha256('old-token') };
    tokenService.rotate(user, 'new-token');

    expect(user.previousRefreshTokenHash).toBe(sha256('old-token'));
    expect(user.refreshToken).toBe(sha256('new-token'));
    expect(user.previousRefreshTokenHash).not.toBe(user.refreshToken);
  });

  test('handles a login that has never rotated (no current token)', () => {
    const user = { refreshToken: null };
    tokenService.rotate(user, 'brand-new-token');

    expect(user.previousRefreshTokenHash).toBeNull();
    expect(user.refreshToken).toBe(sha256('brand-new-token'));
  });
});

describe('tokenService.isReplay', () => {
  test('returns true when the token matches the previous (rotated-out) hash', () => {
    const user = {
      refreshToken: sha256('current-token'),
      previousRefreshTokenHash: sha256('old-token'),
    };
    expect(tokenService.isReplay(user, sha256('old-token'))).toBe(true);
  });

  test('returns false for the CURRENT token (normal refresh, not a replay)', () => {
    const user = {
      refreshToken: sha256('current-token'),
      previousRefreshTokenHash: sha256('old-token'),
    };
    expect(tokenService.isReplay(user, sha256('current-token'))).toBe(false);
  });

  test('returns false when there is no previous token recorded', () => {
    const user = { refreshToken: sha256('current-token'), previousRefreshTokenHash: null };
    expect(tokenService.isReplay(user, sha256('current-token'))).toBe(false);
    expect(tokenService.isReplay(user, sha256('anything-else'))).toBe(false);
  });
});