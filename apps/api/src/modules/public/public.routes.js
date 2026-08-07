const router = require('express').Router();
const publicController = require('./public.controller');

// Public, pre-auth, pre-tenant endpoints (whitelisted in tenantResolver).
// Rate limiting is inherited from the global limiter applied to /api/ in
// loaders/express.js (design: public endpoints are rate-limited).
router.get('/companies', publicController.listCompanies);
router.get('/companies/:companyId/branches', publicController.listBranches);

module.exports = router;
