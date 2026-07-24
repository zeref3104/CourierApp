const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const apiResponse = require('../../utils/apiResponse');

const authController = {
  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const models = req.tenantModels;
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
      user: result.user,
    }, 'Login successful');
  }),

  clientLogin: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const models = req.tenantModels;
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
      user: result.user,
    }, 'Login successful');
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
};

module.exports = authController;