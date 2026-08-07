const router = require('express').Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

// Auth routes
router.use('/auth', require('../../modules/auth/auth.routes'));

// SuperAdmin routes
router.use('/superadmin', require('../../modules/companies/company.routes'));

// Public, pre-auth routes (whitelisted in tenantResolver)
router.use('/public', require('../../modules/public/public.routes'));

// Protected routes (tenant resolved + auth required)
router.use('/customers', require('../../modules/customers/customer.routes'));
router.use('/packages', require('../../modules/packages/package.routes'));
router.use('/payments', require('../../modules/payments/payment.routes'));
router.use('/deliveries', require('../../modules/deliveries/delivery.routes'));
router.use('/branches', require('../../modules/branches/branch.routes'));
router.use('/users', require('../../modules/users/user.routes'));
router.use('/roles', require('../../modules/roles/role.routes'));
router.use('/notifications', require('../../modules/notifications/notification.routes'));
router.use('/reports', require('../../modules/reports/report.routes'));
router.use('/dashboard', require('../../modules/dashboard/dashboard.routes'));
router.use('/rates', require('../../modules/rates/rate.routes'));
router.use('/settings', require('../../modules/settings/setting.routes'));
router.use('/client', require('../../modules/client/client.routes'));

module.exports = router;