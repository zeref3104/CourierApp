const router = require('express').Router();
const packageController = require('./package.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const upload = require('../../middlewares/upload');
const {
  createPackageSchema,
  updatePackageSchema,
  changeStatusSchema,
} = require('../../validators/schemas/package.schema');

router.use(auth);

router.get('/', packageController.findAll);
router.post('/', validate(createPackageSchema), packageController.create);
router.get('/:tracking', packageController.findByTracking);
router.get('/id/:id', packageController.findById);
router.patch('/:id', validate(updatePackageSchema), packageController.update);
router.patch('/:id/status', validate(changeStatusSchema), packageController.changeStatus);
router.post('/:id/photos', upload.array('photos', 5), packageController.uploadPhotos);
router.get('/:id/history', packageController.getHistory);

module.exports = router;