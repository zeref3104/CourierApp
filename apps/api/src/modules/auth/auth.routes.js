const router = require('express').Router();
const authController = require('./auth.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { authLimiter } = require('../../middlewares/rateLimiter');
const { loginSchema, changePasswordSchema, otpSendSchema, otpVerifySchema, registerClientSchema, clientCodeLoginSchema, clientRefreshSchema, forgotPasswordSchema, resetPasswordSchema } = require('@courier/validation');

// Rate limiting for authentication endpoints (10 attempts / 15 min), including
// the public password-recovery endpoints (password-recovery spec R7).
//
// The path filter MUST run inside a default-mounted middleware: Express builds
// `layer.path = match[0]` for `router.use(/regex/)` and then rejects dispatch in
// `trim_prefix` when that match is not a PREFIX of the request path (e.g.
// match 'login' vs path '/login'), so a bare `router.use(/regex/)` never fires.
const AUTH_LIMITER_PATH = /(login|refresh|forgot-password|reset-password)/;
router.use((req, res, next) => {
  if (!AUTH_LIMITER_PATH.test(req.path)) return next();
  return authLimiter(req, res, next);
});

router.post('/login', validate(loginSchema), authController.login);
router.post('/client/login', validate(clientCodeLoginSchema), authController.clientCodeLogin);
router.post('/client/otp/send', validate(otpSendSchema), authController.otpSend);
router.post('/client/otp/verify', validate(otpVerifySchema), authController.otpVerify);
router.post('/client/register', validate(registerClientSchema), authController.register);
router.post('/client/refresh', validate(clientRefreshSchema), authController.clientRefresh);
router.post('/refresh', authController.refresh);
// Public, pre-tenant recovery endpoints. Validation answers 422 (design D3) —
// not the legacy 400 — so zod failures match the endpoint's failure contract.
router.post('/forgot-password', validate(forgotPasswordSchema, 'body', 422), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema, 'body', 422), authController.resetPassword);
router.post('/logout', auth, authController.logout);
router.get('/me', auth, authController.me);
router.patch('/password', auth, validate(changePasswordSchema), authController.changePassword);

module.exports = router;