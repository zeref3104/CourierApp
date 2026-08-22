const router = require('express').Router();
const licenseController = require('./license.controller');
const validate = require('../../middlewares/validate');
const { createLicenseSchema, updateLicenseSchema } = require('@courier/validation');

router.post('/', validate(createLicenseSchema), licenseController.create);
router.get('/', licenseController.findAll);
router.get('/:id', licenseController.findById);
router.patch('/:id', validate(updateLicenseSchema), licenseController.update);
router.delete('/:id', licenseController.delete);

module.exports = router;
