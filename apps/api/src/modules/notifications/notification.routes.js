const router = require('express').Router();
const notificationController = require('./notification.controller');
const auth = require('../../middlewares/auth');
const { staffOnly } = require('../../middlewares/rbac');

router.use(auth);
router.use(staffOnly);

router.get('/', notificationController.findAll);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);

module.exports = router;