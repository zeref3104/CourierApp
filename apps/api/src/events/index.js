const EventEmitter = require('events');

class AppEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }
}

const eventBus = new AppEventBus();

const EVENTS = {
  PACKAGE_CREATED: 'package:created',
  PACKAGE_STATUS_CHANGED: 'package:status_changed',
  PAYMENT_RECEIVED: 'payment:received',
  DELIVERY_COMPLETED: 'delivery:completed',
  CUSTOMER_CREATED: 'customer:created',
  CUSTOMER_UPDATED: 'customer:updated',
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
};

function registerListeners() {
  const activityLogHandler = require('./handlers/activityLogHandler');
  const notificationHandler = require('./handlers/notificationHandler');
  const socketHandler = require('./handlers/socketHandler');

  eventBus.on(EVENTS.PACKAGE_STATUS_CHANGED, (payload) => {
    activityLogHandler.onPackageStatusChanged(payload);
    notificationHandler.onPackageStatusChanged(payload);
    socketHandler.onPackageStatusChanged(payload);
  });

  eventBus.on(EVENTS.PAYMENT_RECEIVED, (payload) => {
    activityLogHandler.onPaymentReceived(payload);
    notificationHandler.onPaymentReceived(payload);
    socketHandler.onPaymentReceived(payload);
  });

  eventBus.on(EVENTS.DELIVERY_COMPLETED, (payload) => {
    activityLogHandler.onDeliveryCompleted(payload);
    notificationHandler.onDeliveryCompleted(payload);
    socketHandler.onDeliveryCompleted(payload);
  });

  eventBus.on(EVENTS.PACKAGE_CREATED, (payload) => {
    activityLogHandler.onPackageCreated(payload);
    notificationHandler.onPackageCreated(payload);
    socketHandler.onPackageCreated(payload);
  });

  eventBus.on(EVENTS.CUSTOMER_CREATED, (payload) => {
    activityLogHandler.onCustomerCreated(payload);
  });

  eventBus.on(EVENTS.USER_LOGIN, (payload) => {
    activityLogHandler.onUserLogin(payload);
  });
}

module.exports = { eventBus, EVENTS, registerListeners };