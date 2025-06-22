// models/Notification.js - Enhanced for in-app notifications
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  type: {
    type: String,
    required: true,
    enum: [
      'friend_request',
      'friend_request_accepted', 
      'event_invitation',
      'event_reminder',
      'memory_invitation',
      'memory_photo_added',
      'event_update',
      'event_cancelled',
      'new_follower'
    ]
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // In-app notification states
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  // Actions
  actionType: {
    type: String,
    enum: ['VIEW_PROFILE', 'VIEW_EVENT', 'VIEW_MEMORY', 'ACCEPT_REQUEST', 'NONE'],
    default: 'NONE'
  },
  actionData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Delivery status
  pushSent: {
    type: Boolean,
    default: false,
  },
  pushSentAt: {
    type: Date,
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

// Indexes
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);