const router = require('express').Router();
const companyController = require('./company.controller');
const authController = require('../auth/auth.controller');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const { authorizeSuperAdmin } = require('../../middlewares/rbac');
const { superadminLoginSchema } = require('../../validators/schemas/auth.schema');

// Public superadmin login (no auth required)
router.post('/login', validate(superadminLoginSchema), authController.superadminLogin);

// All other superadmin routes need auth + superadmin role check
router.use(auth);
router.use(authorizeSuperAdmin);

router.get('/companies', companyController.findAll);
router.post('/companies', companyController.create);
router.get('/companies/:id', companyController.findById);
router.patch('/companies/:id', companyController.update);
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

router.get('/licenses', async (req, res) => {
  const License = req.app.locals.masterConnection.model('License');
  const filter = {};
  if (req.query.companyId) filter.companyId = req.query.companyId;
  const licenses = await License.find(filter).populate('companyId planId').sort({ createdAt: -1 });
  res.json({ success: true, data: licenses });
});

module.exports = router;