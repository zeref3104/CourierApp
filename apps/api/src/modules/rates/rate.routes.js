const router = require('express').Router();
const rateController = require('./rate.controller');
const auth = require('../../middlewares/auth');
const { authorize } = require('../../middlewares/rbac');
const validate = require('../../middlewares/validate');
const { createRateSchema, updateRateSchema } = require('@courier/validation');

router.use(auth);

router.get('/active', rateController.getActive);
router.get('/', rateController.findAll);
router.get('/:id', rateController.findById);
router.post('/', authorize('admin'), validate(createRateSchema), rateController.create);
router.patch('/:id', authorize('admin'), validate(updateRateSchema), rateController.update);

module.exports = router;