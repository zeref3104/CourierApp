const router = require('express').Router();
const paymentController = require('./payment.controller');
const auth = require('../../middlewares/auth');
const { staffOnly } = require('../../middlewares/rbac');
const validate = require('../../middlewares/validate');
const { createPaymentSchema } = require('@courier/validation');

router.use(auth);
router.use(staffOnly);

router.get('/', paymentController.findAll);
router.post('/', validate(createPaymentSchema), paymentController.create);
router.get('/summary/daily', paymentController.getDailySummary);
router.get('/:id', paymentController.findById);

module.exports = router;