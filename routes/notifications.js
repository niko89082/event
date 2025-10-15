// routes/notifications.js - PHASE 1: Enhanced with individual deletion
const express = require('express');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════════
   GET /api/notifications - Get user notifications with category support
═══════════════════════════════════════════════════════════════════ */
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category; // 'social', 'events', or null for all

    console.log(`🔔 Fetching notifications for user ${req.user._id}:`, { page, limit, category });

    const result = await notificationService.getUserNotifications(
      req.user._id, 
      page, 
      limit,
      category
    );

    console.log(`🔔 Found ${result.notifications.length} notifications, unread counts:`, result.unreadCounts);

    res.json({
      notifications: result.notifications,
      pagination: result.pagination,
      unreadCounts: result.unreadCounts
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   GET /api/notifications/unread-count - Get unread counts by category
═══════════════════════════════════════════════════════════════════ */
router.get('/unread-count', protect, async (req, res) => {
  try {
    const result = await notificationService.getUserNotifications(req.user._id, 1, 1);
    
    res.json({
      total: result.unreadCounts.total,
      social: result.unreadCounts.social,
      events: result.unreadCounts.events
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   PUT /api/notifications/:id/read - Mark single notification as read
═══════════════════════════════════════════════════════════════════ */
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id, 
      req.user._id
    );

    console.log(`🔔 Marked notification ${req.params.id} as read`);

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




router.post('/cleanup-friend-requests', protect, async (req, res) => {
  try {
    const { userId1, userId2, action } = req.body;
    const currentUserId = req.user._id;

    console.log(`🧹 Cleaning up friend request notifications: ${userId1} <-> ${userId2}, action: ${action}`);

    if (action === 'accepted') {
      // When accepted, mark all friend request notifications between these users as read/handled
      await Notification.updateMany(
        {
          $or: [
            { user: userId1, sender: userId2, type: 'friend_request' },
            { user: userId2, sender: userId1, type: 'friend_request' }
          ]
        },
        {
          isRead: true,
          readAt: new Date(),
          $set: { 'data.actionTaken': 'accepted' }
        }
      );

      // Create acceptance notification for the requester
      const requester = userId1 === currentUserId ? userId2 : userId1;
      await notificationService.createNotification({
        userId: requester,
        senderId: currentUserId,
        category: 'social',
        type: 'friend_request_accepted',
        title: 'Friend Request Accepted',
        message: `${req.user.username} accepted your friend request`,
        data: {
          userId: currentUserId
        },
        actionType: 'VIEW_PROFILE',
        actionData: { userId: currentUserId }
      });

    } else if (action === 'rejected') {
      // When rejected, remove all friend request notifications between these users
      await Notification.deleteMany({
        $or: [
          { user: userId1, sender: userId2, type: 'friend_request' },
          { user: userId2, sender: userId1, type: 'friend_request' }
        ]
      });
    }

    res.json({ success: true, message: 'Notifications cleaned up' });
  } catch (error) {
    console.error('Error cleaning up friend request notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



/* ═══════════════════════════════════════════════════════════════════
   🔧 PHASE 1 NEW: DELETE /api/notifications/:notificationId - Delete individual notification
═══════════════════════════════════════════════════════════════════ */
router.delete('/:notificationId', protect, async (req, res) => {
  try {
    const notificationId = req.params.notificationId;
    const userId = req.user._id;

    console.log(`🗑️ Deleting notification ${notificationId} for user ${userId}`);

    // Import Notification model directly for this operation
    const Notification = require('../models/Notification');

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId // Ensure user can only delete their own notifications
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or you do not have permission to delete it'
      });
    }

    console.log(`✅ Successfully deleted notification ${notificationId} of type ${notification.type}`);

    res.json({
      success: true,
      message: 'Notification removed successfully',
      deletedNotification: {
        id: notification._id,
        type: notification.type,
        category: notification.category || 'unknown'
      }
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    
    // Handle invalid ObjectId errors gracefully
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notification'
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/notifications/mark-all-read - Mark all notifications as read
═══════════════════════════════════════════════════════════════════ */
router.post('/mark-all-read', protect, async (req, res) => {
  try {
    const { category } = req.body; // Optional: 'social', 'events', or null for all
    
    await notificationService.markAllAsRead(req.user._id, category);
    
    console.log(`🔔 Marked all ${category || 'all'} notifications as read for user ${req.user._id}`);

    res.json({ success: true, message: `All ${category || ''} notifications marked as read` });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   🔧 PHASE 1 NEW: DELETE /api/notifications/batch - Delete multiple notifications
   This provides foundation for future bulk operations
═══════════════════════════════════════════════════════════════════ */
router.delete('/batch', protect, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification IDs provided. Expected non-empty array.'
      });
    }

    if (notificationIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete more than 50 notifications at once'
      });
    }

    console.log(`🗑️ Batch deleting ${notificationIds.length} notifications for user ${userId}`);

    // Import Notification model directly
    const Notification = require('../models/Notification');

    const result = await Notification.deleteMany({
      _id: { $in: notificationIds },
      user: userId // Ensure user can only delete their own notifications
    });

    console.log(`✅ Successfully deleted ${result.deletedCount} out of ${notificationIds.length} requested notifications`);

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} notifications`,
      deletedCount: result.deletedCount,
      requestedCount: notificationIds.length
    });

  } catch (error) {
    console.error('Error deleting notifications in batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting notifications'
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   DELETE /api/notifications/:id - Delete single notification (legacy compatibility)
   Note: This is the same as /:notificationId but kept for any existing API calls
═══════════════════════════════════════════════════════════════════ */
router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await notificationService.deleteNotification(
      req.params.id, 
      req.user._id
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    console.log(`🔔 Deleted notification ${req.params.id}`);

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/notifications/test - Create test notifications (DEV ONLY)
═══════════════════════════════════════════════════════════════════ */
router.post('/test', protect, async (req, res) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: 'Test endpoint not available in production' });
  }
  
  try {
    const { type = 'friend_request' } = req.body;
    const userId = req.user._id;
    
    console.log(`🧪 Creating test notification: ${type}`);
    
    let notification;
    
    switch (type) {
      case 'friend_request':
        notification = await notificationService.sendFriendRequest(userId, userId);
        break;
        
      case 'new_follower':
        notification = await notificationService.sendNewFollower(userId, userId);
        break;
        
      case 'event_invitation':
        notification = await notificationService.createNotification({
          userId,
          senderId: userId,
          category: 'events',
          type: 'event_invitation',
          title: 'Event Invitation',
          message: 'You\'ve been invited to "Test Party"',
          actionType: 'VIEW_EVENT',
          actionData: { eventId: 'test' }
        });
        break;
        
      case 'event_reminder':
        notification = await notificationService.createNotification({
          userId,
          senderId: null,
          category: 'events',
          type: 'event_reminder',
          title: 'Event Tomorrow',
          message: 'Don\'t forget: "Test Party" is tomorrow',
          actionType: 'VIEW_EVENT',
          actionData: { eventId: 'test' }
        });
        break;
        
      case 'memory_photo_added':
        notification = await notificationService.createNotification({
          userId,
          senderId: userId,
          category: 'social',
          type: 'memory_photo_added',
          title: 'New Memory Photo',
          message: 'Someone added a photo to "Test Memory"',
          actionType: 'VIEW_MEMORY',
          actionData: { memoryId: 'test' }
        });
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid test type' });
    }
    
    res.json({ 
      success: true, 
      message: `Test ${type} notification created`,
      notification 
    });
  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   LEGACY ROUTES (for backward compatibility)
═══════════════════════════════════════════════════════════════════ */

// PATCH /api/notifications/:id/read (legacy)
router.patch('/:id/read', protect, async (req, res) => {
  console.log('⚠️ Using legacy PATCH route, consider switching to PUT');
  try {
    const notification = await notificationService.markAsRead(
      req.params.id, 
      req.user._id
    );

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/notifications/read-all (legacy)
router.patch('/read-all', protect, async (req, res) => {
  console.log('⚠️ Using legacy PATCH route, consider switching to POST mark-all-read');
  try {
    await notificationService.markAllAsRead(req.user._id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/notifications/test - Create test notifications for testing UI
═══════════════════════════════════════════════════════════════════ */
router.post('/test', protect, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const User = require('../models/User');
    
    console.log(`🧪 Creating test notifications for user ${req.user._id}`);
    
    // Create various types of test notifications
    const testNotifications = [
      {
        user: req.user._id,
        type: 'friend_request',
        title: 'New Friend Request',
        message: 'John Doe sent you a friend request',
        category: 'social',
        data: {
          requester: {
            _id: '507f1f77bcf86cd799439011',
            username: 'johndoe',
            displayName: 'John Doe',
            profilePicture: null
          }
        }
      },
      {
        user: req.user._id,
        type: 'friend_request_accepted',
        title: 'Friend Request Accepted',
        message: 'Jane Smith accepted your friend request',
        category: 'social',
        data: {
          accepter: {
            _id: '507f1f77bcf86cd799439012',
            username: 'janesmith',
            displayName: 'Jane Smith',
            profilePicture: null
          }
        }
      },
      {
        user: req.user._id,
        type: 'event_invitation',
        title: 'Event Invitation',
        message: 'You\'re invited to "Tech Meetup 2024"',
        category: 'events',
        data: {
          event: {
            _id: '507f1f77bcf86cd799439013',
            title: 'Tech Meetup 2024',
            time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            location: 'San Francisco, CA'
          },
          inviter: {
            _id: '507f1f77bcf86cd799439014',
            username: 'alextech',
            displayName: 'Alex Tech'
          }
        }
      },
      {
        user: req.user._id,
        type: 'event_reminder',
        title: 'Event Reminder',
        message: 'Tech Meetup 2024 starts in 1 hour',
        category: 'events',
        data: {
          event: {
            _id: '507f1f77bcf86cd799439013',
            title: 'Tech Meetup 2024',
            time: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
            location: 'San Francisco, CA'
          }
        }
      },
      {
        user: req.user._id,
        type: 'photo_comment',
        title: 'New Comment',
        message: 'Mike Johnson commented on your photo',
        category: 'social',
        data: {
          commenter: {
            _id: '507f1f77bcf86cd799439015',
            username: 'mikejohnson',
            displayName: 'Mike Johnson',
            profilePicture: null
          },
          photo: {
            _id: '507f1f77bcf86cd799439016',
            caption: 'Great event last night!'
          }
        }
      }
    ];

    // Create notifications with different timestamps
    const createdNotifications = [];
    for (let i = 0; i < testNotifications.length; i++) {
      const notification = new Notification({
        ...testNotifications[i],
        createdAt: new Date(Date.now() - i * 60 * 60 * 1000), // Each notification 1 hour apart
        isRead: i % 3 === 0 // Make some read, some unread
      });
      
      await notification.save();
      createdNotifications.push(notification);
    }

    console.log(`✅ Created ${createdNotifications.length} test notifications`);

    res.json({
      success: true,
      message: `Created ${createdNotifications.length} test notifications`,
      notifications: createdNotifications.map(n => ({
        _id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        category: n.category,
        isRead: n.isRead,
        createdAt: n.createdAt
      }))
    });

  } catch (error) {
    console.error('Error creating test notifications:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   DELETE /api/notifications/test - Clear all test notifications
═══════════════════════════════════════════════════════════════════ */
router.delete('/test', protect, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    
    console.log(`🧹 Clearing test notifications for user ${req.user._id}`);
    
    // Delete all notifications for this user (be careful in production!)
    const result = await Notification.deleteMany({ user: req.user._id });
    
    console.log(`✅ Deleted ${result.deletedCount} notifications`);

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} notifications`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error clearing test notifications:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});

module.exports = router;