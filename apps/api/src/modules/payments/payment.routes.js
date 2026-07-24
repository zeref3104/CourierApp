const router = require('express').Router();
const paymentController = require('./payment.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { createPaymentSchema } = require('../../validators/schemas/payment.schema');

router.use(auth);

router.get('/', paymentController.findAll);
router.post('/', validate(createPaymentSchema), paymentController.create);
router.get('/summary/daily', paymentController.getDailySummary);
router.get('/:id', paymentController.findById);

module.exports = router;