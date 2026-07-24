const router = require('express').Router();
const reportController = require('./report.controller');
const auth = require('../../middlewares/auth');
const { authorize } = require('../../middlewares/rbac');

router.use(auth);

router.get('/customers', authorize('admin'), reportController.customers);
router.get('/packages', authorize('admin'), reportController.packages);
router.get('/income', authorize('admin'), reportController.income);
router.get('/deliveries', authorize('admin'), reportController.deliveries);

module.exports = router;