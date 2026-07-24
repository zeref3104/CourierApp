const router = require('express').Router();
const deliveryController = require('./delivery.controller');
const auth = require('../../middlewares/auth');

router.use(auth);

router.get('/today', deliveryController.getToday);
router.get('/stats', deliveryController.getStats);
router.get('/', deliveryController.findAll);
router.post('/', deliveryController.create);
router.patch('/:id/complete', deliveryController.completeDelivery);

module.exports = router;