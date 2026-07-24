const router = require('express').Router();
const rateController = require('./rate.controller');
const auth = require('../../middlewares/auth');
const { authorize } = require('../../middlewares/rbac');

router.use(auth);

router.get('/active', rateController.getActive);
router.get('/', rateController.findAll);
router.get('/:id', rateController.findById);
router.post('/', authorize('admin'), rateController.create);
router.patch('/:id', authorize('admin'), rateController.update);

module.exports = router;