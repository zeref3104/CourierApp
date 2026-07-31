const router = require('express').Router();
const customerController = require('./customer.controller');
const auth = require('../../middlewares/auth');
const { staffOnly } = require('../../middlewares/rbac');
const validate = require('../../middlewares/validate');
const { createCustomerSchema, updateCustomerSchema } = require('@courier/validation');

router.use(auth);
router.use(staffOnly);

router.get('/', customerController.findAll);
router.post('/', validate(createCustomerSchema), customerController.create);
router.get('/:id', customerController.findById);
router.patch('/:id', validate(updateCustomerSchema), customerController.update);
router.delete('/:id', customerController.deactivate);
router.get('/:id/packages', customerController.getPackages);
router.get('/:id/payments', customerController.getPayments);

module.exports = router;