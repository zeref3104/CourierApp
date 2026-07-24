const router = require('express').Router();
const userController = require('./user.controller');
const auth = require('../../middlewares/auth');
const { authorize } = require('../../middlewares/rbac');
const validate = require('../../middlewares/validate');
const { createUserSchema, updateUserSchema } = require('../../validators/schemas/user.schema');
const { changePasswordSchema } = require('../../validators/schemas/auth.schema');

router.use(auth);

router.get('/', authorize('admin'), userController.findAll);
router.post('/', authorize('admin'), validate(createUserSchema), userController.create);
router.patch('/:id', authorize('admin'), validate(updateUserSchema), userController.update);
router.delete('/:id', authorize('admin'), userController.deactivate);
router.post('/change-password', validate(changePasswordSchema), userController.changePassword);

module.exports = router;