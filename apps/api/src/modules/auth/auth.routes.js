const router = require('express').Router();
const authController = require('./auth.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { authLimiter } = require('../../middlewares/rateLimiter');
const { loginSchema, changePasswordSchema } = require('../../validators/schemas/auth.schema');

// Rate limiting for authentication endpoints (10 attempts / 15 min)
router.use(/(login|refresh)/, authLimiter);

router.post('/login', validate(loginSchema), authController.login);
router.post('/client/login', validate(loginSchema), authController.clientLogin);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.get('/me', auth, authController.me);
router.patch('/password', auth, validate(changePasswordSchema), authController.changePassword);

module.exports = router;