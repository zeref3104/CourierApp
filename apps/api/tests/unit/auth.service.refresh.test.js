/**
 * Unit tests for authService.refresh replay-aware rotation (client-mobile-app
 * task 3.4, design D10). The shared refresh path gains replay detection:
 * - a valid CURRENT refresh token rotates (mass -> previous, new -> current)
 * - a rotated-out token (previousRefreshTokenHash hit) is a REPLAY -> revoke
 *   the client ALL its tokens and 401
 * - an already-blacklisted token is rejected first
 * - an unknown token (neither current nor previous) is an invalid refresh
 *
 * Private helpers (_findSuperAdminSession / _findSession / _findReplaySession /
 * _revokeClientTokens) are spied to keep the unit fast and focused.
 */
const authService = require('../../src/modules/auth/auth.service');
const tokenService = require('../../src/modules/auth/token.service');
const jwtService = require('../../src/services/auth/jwt.service');
const UnauthorizedException = require('../../src/exceptions/UnauthorizedException');

jest.mock('../../src/services/auth/jwt.service', () => ({ generateAccessToken: jest.fn() }));
jest.mock('../../src/services/tenant/connectionManager', () => ({ getConnection: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jwtService.generateAccessToken.mockReturnValue('access-token-2');
});

describe('authService.refresh (replay-aware rotation)', () => {
  test('rotates a valid current token: previous hash kept, new hash stored, new access token', async () => {
    const user = {
      _id: 'user-1',
      email: 'cliente@example.com',
      roleId: 'role-client',
      branchId: 'branch-1',
      clientId: 'customer-1',
      isClient: true,
      refreshToken: 'hash-current',
      previousRefreshTokenHash: 'hash-old',
      save: jest.fn().mockResolvedValue(undefined),
    };
    const connection = { model: jest.fn(() => ({ findById: jest.fn().mockResolvedValue({ code: 'client', permissions: [] }) })) };
    jest.spyOn(tokenService, 'isBlacklisted').mockResolvedValue(false);
    jest.spyOn(authService, '_findSuperAdminSession').mockResolvedValue(null);
    jest.spyOn(authService, '_findSession').mockResolvedValue({ user, connection, tenantSlug: 'rapid-box' });
    jest.spyOn(authService, '_findReplaySession').mockResolvedValue(null);
    jest.spyOn(tokenService, 'generateRefreshToken').mockReturnValue('new-refresh');
    jest.spyOn(tokenService, 'hashToken').mockImplementation((t) => `hash(${t})`);

    const result = await authService.refresh('the-current-token', { master: true });

    // rotation: old current hash becomes previous; new refresh stored as current
    expect(user.previousRefreshTokenHash).toBe('hash-current');
    expect(user.refreshToken).toBe('hash(new-refresh)');
    expect(result.refreshToken).toBe('new-refresh');
    expect(result.accessToken).toBe('access-token-2');
    expect(jwtService.generateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ isClient: true, clientId: 'customer-1', tenant: 'rapid-box' })
    );
    expect(authService._findReplaySession).not.toHaveBeenCalled();
  });

  test('401: a reused (replayed) token revokes ALL the client tokens', async () => {
    const user = {
      _id: 'user-1',
      clientId: 'customer-1',
      isClient: true,
    };
    const User = { updateMany: jest.fn().mockResolvedValue({}), updateOne: jest.fn() };
    const connection = { model: jest.fn(() => User) };
    jest.spyOn(tokenService, 'isBlacklisted').mockResolvedValue(false);
    jest.spyOn(authService, '_findSuperAdminSession').mockResolvedValue(null);
    jest.spyOn(authService, '_findSession').mockResolvedValue(null);
    jest.spyOn(authService, '_findReplaySession').mockResolvedValue({ user, connection });
    jest.spyOn(tokenService, 'blacklist').mockResolvedValue(undefined);

    await expect(authService.refresh('stale-token', { master: true })).rejects.toBeInstanceOf(
      UnauthorizedException
    );

    // ALL tokens for the client (any device on the same clientId) are revoked
    expect(User.updateMany).toHaveBeenCalledWith(
      { clientId: 'customer-1' },
      { $set: { refreshToken: null, previousRefreshTokenHash: null } }
    );
    // and the replayed raw token is blacklisted
    expect(tokenService.blacklist).toHaveBeenCalledWith('stale-token', { master: true });
  });

  test('401: blacklisted token is rejected before any session lookup', async () => {
    jest.spyOn(tokenService, 'isBlacklisted').mockResolvedValue(true);
    const spySession = jest.spyOn(authService, '_findSession');

    await expect(authService.refresh('blacklisted', { master: true })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(spySession).not.toHaveBeenCalled();
  });

  test('401: a token matching neither current nor previous is an invalid refresh', async () => {
    jest.spyOn(tokenService, 'isBlacklisted').mockResolvedValue(false);
    jest.spyOn(authService, '_findSuperAdminSession').mockResolvedValue(null);
    jest.spyOn(authService, '_findSession').mockResolvedValue(null);
    jest.spyOn(authService, '_findReplaySession').mockResolvedValue(null);

    await expect(authService.refresh('unknown-token', { master: true })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});