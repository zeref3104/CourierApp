const router = require('express').Router();
const deliveryController = require('./delivery.controller');
const auth = require('../../middlewares/auth');
const { staffOnly } = require('../../middlewares/rbac');
const validate = require('../../middlewares/validate');
const {
  createDeliverySchema,
  completeDeliverySchema,
} = require('@courier/validation');

router.use(auth);
router.use(staffOnly);

router.get('/today', deliveryController.getToday);
router.get('/stats', deliveryController.getStats);
router.get('/', deliveryController.findAll);
router.post('/', validate(createDeliverySchema), deliveryController.create);
router.patch('/:id/complete', validate(completeDeliverySchema), deliveryController.completeDelivery);

module.exports = router;