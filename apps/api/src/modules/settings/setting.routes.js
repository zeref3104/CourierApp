const router = require('express').Router();
const settingController = require('./setting.controller');
const auth = require('../../middlewares/auth');
const { authorize } = require('../../middlewares/rbac');
const upload = require('../../middlewares/upload');
const validate = require('../../middlewares/validate');
const { updateSettingsSchema } = require('../../validators/schemas/setting.schema');

router.get('/public', settingController.getPublic);

router.use(auth);

router.get('/', settingController.findAll);
router.patch('/', authorize('admin'), validate(updateSettingsSchema), settingController.update);
router.post('/logo', authorize('admin'), upload.single('logo'), settingController.uploadLogo);

module.exports = router;