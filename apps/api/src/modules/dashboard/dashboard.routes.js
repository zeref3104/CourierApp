const router = require('express').Router();
const dashboardController = require('./dashboard.controller');
const auth = require('../../middlewares/auth');
const { staffOnly } = require('../../middlewares/rbac');

router.use(auth);
router.use(staffOnly);

router.get('/summary', dashboardController.summary);
router.get('/charts', dashboardController.charts);
router.get('/recent', dashboardController.recent);

module.exports = router;