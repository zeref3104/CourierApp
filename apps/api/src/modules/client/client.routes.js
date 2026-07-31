const router = require('express').Router();
const clientController = require('./client.controller');
const auth = require('../../middlewares/auth');
const PlanEnforcer = require('../../services/planEnforcer');

/**
 * Client panel is a plan feature (Plan.features.clientPanel). Wire the
 * otherwise-unused PlanEnforcer.checkClientPanel here so every client endpoint
 * is blocked when the tenant's plan disables the panel. Fails open when no
 * plan is attached (e.g. the dev-mode auth fallback that does not load it).
 */
function requireClientPanel(req, res, next) {
  if (!req.tenant?.plan) return next();
  try {
    new PlanEnforcer(req.tenant.plan, req.tenantModels).checkClientPanel();
    next();
  } catch (err) {
    next(err);
  }
}

router.use(auth);
router.use(requireClientPanel);

router.get('/dashboard', clientController.dashboard);
router.get('/packages', clientController.packages);
router.get('/packages/:tracking', clientController.packageDetail);
router.get('/profile', clientController.profile);
router.patch('/profile', clientController.updateProfile);
router.get('/notifications', clientController.notifications);
router.get('/miami-address', clientController.miamiAddress);
router.get('/code', clientController.code);

module.exports = router;
