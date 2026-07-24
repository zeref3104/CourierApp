const router = require('express').Router();
const dashboardController = require('./dashboard.controller');
const auth = require('../../middlewares/auth');

router.use(auth);

router.get('/summary', dashboardController.summary);
router.get('/charts', dashboardController.charts);
router.get('/recent', dashboardController.recent);

module.exports = router;