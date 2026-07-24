const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    type: {
      type: String,
      enum: ['package_status', 'payment', 'system', 'delivery'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'whatsapp', 'push'],
      default: 'in_app',
    },
    sentAt: { type: Date, default: Date.now },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ customerId: 1, isRead: 1, createdAt: -1 });

module.exports = (connection) => connection.model('Notification', notificationSchema);