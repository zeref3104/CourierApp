const router = require('express').Router();
const companyController = require('./company.controller');
const authController = require('../auth/auth.controller');
const licenseController = require('./license.controller');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const { authorizeSuperAdmin } = require('../../middlewares/rbac');
const { superadminLoginSchema, createCompanySchema, updateCompanySchema, createLicenseSchema, updateLicenseSchema } = require('@courier/validation');

// Public superadmin login (no auth required)
router.post('/login', validate(superadminLoginSchema), authController.superadminLogin);

// All other superadmin routes need auth + superadmin role check
router.use(auth);
router.use(authorizeSuperAdmin);

router.get('/companies', companyController.findAll);
router.post('/companies', validate(createCompanySchema), companyController.create);
router.get('/companies/:id', companyController.findById);
router.patch('/companies/:id', validate(updateCompanySchema), companyController.update);
router.delete('/companies/:id', companyController.delete);

router.get('/plans', async (req, res) => {
  const Plan = req.app.locals.masterConnection.model('Plan');
  const plans = await Plan.find({ isActive: true });
  res.json({ success: true, data: plans });
});

router.post('/plans', async (req, res) => {
  const Plan = req.app.locals.masterConnection.model('Plan');
  const plan = await Plan.create(req.body);
  res.status(201).json({ success: true, data: plan });
});

router.patch('/plans/:id', async (req, res) => {
  const Plan = req.app.locals.masterConnection.model('Plan');
  const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: plan });
});

// License CRUD
router.post('/licenses', validate(createLicenseSchema), licenseController.create);
router.get('/licenses', licenseController.findAll);
router.get('/licenses/:id', licenseController.findById);
router.patch('/licenses/:id', validate(updateLicenseSchema), licenseController.update);
router.delete('/licenses/:id', licenseController.delete);

module.exports = router;