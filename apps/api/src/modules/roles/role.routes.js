const router = require('express').Router();
const roleController = require('./role.controller');
const auth = require('../../middlewares/auth');
const { authorize } = require('../../middlewares/rbac');

router.use(auth);

router.get('/', roleController.findAll);
router.post('/', authorize('admin'), roleController.create);
router.patch('/:id', authorize('admin'), roleController.update);
router.delete('/:id', authorize('admin'), roleController.delete);

module.exports = router;