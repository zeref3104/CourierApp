const router = require('express').Router();
const roleController = require('./role.controller');
const auth = require('../../middlewares/auth');
const { staffOnly, authorize } = require('../../middlewares/rbac');
const validate = require('../../middlewares/validate');
const { createRoleSchema, updateRoleSchema } = require('../../validators/schemas/role.schema');

router.use(auth);
router.use(staffOnly);

router.get('/', roleController.findAll);
router.post('/', authorize('admin'), validate(createRoleSchema), roleController.create);
router.patch('/:id', authorize('admin'), validate(updateRoleSchema), roleController.update);
router.delete('/:id', authorize('admin'), roleController.delete);

module.exports = router;
