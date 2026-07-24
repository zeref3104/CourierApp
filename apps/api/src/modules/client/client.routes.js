const router = require('express').Router();
const clientController = require('./client.controller');
const auth = require('../../middlewares/auth');

router.use(auth);

router.get('/dashboard', clientController.dashboard);
router.get('/packages', clientController.packages);
router.get('/packages/:tracking', clientController.packageDetail);
router.get('/profile', clientController.profile);
router.patch('/profile', clientController.updateProfile);
router.get('/notifications', clientController.notifications);
router.get('/miami-address', clientController.miamiAddress);
router.get('/code', clientController.code);

module.exports = router;