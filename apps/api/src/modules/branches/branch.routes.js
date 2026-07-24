const router = require('express').Router();
const branchController = require('./branch.controller');
const auth = require('../../middlewares/auth');
const { authorize } = require('../../middlewares/rbac');

router.use(auth);

router.get('/', branchController.findAll);
router.get('/:id', branchController.findById);
router.post('/', authorize('admin'), branchController.create);
router.patch('/:id', authorize('admin'), branchController.update);
router.delete('/:id', authorize('admin'), branchController.deactivate);

module.exports = router;