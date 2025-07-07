// routes/notifications.js - PHASE 3: Enhanced with categories and batching
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
   DELETE /api/notifications/:id - Delete single notification
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

module.exports = router;