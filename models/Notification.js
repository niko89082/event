// models/Notification.js - PHASE 3: Enhanced with simplified categories
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
  
  // 🔔 PHASE 3: Simplified notification categories
  category: {
    type: String,
    required: true,
    enum: ['social', 'events'],
    default: 'social'
  },
  
  type: {
    type: String,
    required: true,
    enum: [
      // Social notifications
      'friend_request',
      'friend_request_accepted', 
      'new_follower',
      'memory_photo_added',
      'memory_invitation',
      'memory_photo_batch',                   // 🆕 NEW: When multiple friends upload photos
      
      // Event notifications
      'event_invitation',
      'event_reminder',
      'event_reminder_1_hour',                // 🆕 NEW: Event starting in 1 hour
      'event_update',
      'event_cancelled',
      'event_announcement',
      'event_rsvp_batch', // Batched RSVP notifications
      
      // Engagement (simplified - could be merged with social)
      'post_liked',
      'post_commented',
      'memory_photo_liked'
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
  
  // Enhanced data structure
  data: {
    // Core data
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    memoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory' },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Photo' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Batching support
    count: { type: Number, default: 1 },
    uploaderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // For batched memory photos
    
    // Additional context
    reminderType: String, // '1_hour', '1_day', etc.
    announcement: String, // For event announcements
  },
  
  // Action handling
  actionType: {
    type: String,
    enum: ['NONE', 'VIEW_PROFILE', 'VIEW_EVENT', 'VIEW_MEMORY', 'VIEW_POST', 'ACCEPT_REQUEST'],
    default: 'NONE'
  },
  actionData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  
  isRead: {
    type: Boolean,
    default: false,
  },
  
  isBatched: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
});

// Indexes for performance
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, category: 1, isRead: 1 });
NotificationSchema.index({ user: 1, type: 1, createdAt: -1 });

// Static method to get unread counts by category
NotificationSchema.statics.getUnreadCountByCategory = function(userId) {
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), isRead: false } }, // ✅ FIXED
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $project: { category: '$_id', count: 1, _id: 0 } }
  ]);
};

// Instance method to update batch count
NotificationSchema.methods.updateBatchCount = function(newCount) {
  this.data.count = newCount;
  this.isBatched = true;
  this.updatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', NotificationSchema);