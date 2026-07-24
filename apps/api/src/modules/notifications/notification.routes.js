const router = require('express').Router();
const notificationController = require('./notification.controller');
const auth = require('../../middlewares/auth');

router.use(auth);

router.get('/', notificationController.findAll);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);

module.exports = router;