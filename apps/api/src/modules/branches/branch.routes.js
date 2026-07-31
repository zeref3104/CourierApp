const router = require('express').Router();
const branchController = require('./branch.controller');
const auth = require('../../middlewares/auth');
const { staffOnly, authorize } = require('../../middlewares/rbac');
const validate = require('../../middlewares/validate');
const { createBranchSchema, updateBranchSchema } = require('../../validators/schemas/branch.schema');

router.use(auth);
router.use(staffOnly);

router.get('/', branchController.findAll);
router.get('/:id', branchController.findById);
router.post('/', authorize('admin'), validate(createBranchSchema), branchController.create);
router.patch('/:id', authorize('admin'), validate(updateBranchSchema), branchController.update);
router.delete('/:id', authorize('admin'), branchController.deactivate);

module.exports = router;
