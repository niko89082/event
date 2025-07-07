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
      
      // Event notifications
      'event_invitation',
      'event_reminder',
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
    
    // Batching support for RSVP notifications
    count: { type: Number, default: 1 },
    lastUpdated: { type: Date, default: Date.now },
    
    // Additional context
    extra: { type: mongoose.Schema.Types.Mixed, default: {} }
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
    enum: ['VIEW_PROFILE', 'VIEW_EVENT', 'VIEW_MEMORY', 'VIEW_POST', 'ACCEPT_REQUEST', 'NONE'],
    default: 'NONE'
  },
  actionData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Priority for sorting/display
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  
  // Delivery tracking
  pushSent: {
    type: Boolean,
    default: false,
  },
  pushSentAt: {
    type: Date,
  },
  
  // Expiry for auto-cleanup
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },
  
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

// 🔔 PHASE 3: Enhanced indexes for better performance
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ user: 1, category: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, type: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-cleanup

// 🔔 PHASE 3: Virtual for category display
NotificationSchema.virtual('categoryDisplay').get(function() {
  return this.category.charAt(0).toUpperCase() + this.category.slice(1);
});

// 🔔 PHASE 3: Instance methods
NotificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

NotificationSchema.methods.updateBatchCount = function(newCount) {
  this.data.count = newCount;
  this.data.lastUpdated = new Date();
  this.createdAt = new Date(); // Move to top of notifications
  return this.save();
};

// 🔔 PHASE 3: Static methods for batch operations
NotificationSchema.statics.markAllAsReadForUser = function(userId, category = null) {
  const query = { user: userId, isRead: false };
  if (category) {
    query.category = category;
  }
  
  return this.updateMany(query, {
    isRead: true,
    readAt: new Date()
  });
};

NotificationSchema.statics.getUnreadCountByCategory = function(userId) {
  return this.aggregate([
    { $match: { user: userId, isRead: false } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $project: { category: '$_id', count: 1, _id: 0 } }
  ]);
};

// 🔔 PHASE 3: Auto-populate sender info
NotificationSchema.pre(/^find/, function() {
  this.populate('sender', 'username fullName profilePicture');
});

// JSON transform to include virtuals
NotificationSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);