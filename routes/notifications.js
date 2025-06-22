// routes/notifications.js - In-app notifications API
const express = require('express');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

/* ───────────────────────────────────────────────────────────────────
   GET /api/notifications - Get user notifications
──────────────────────────────────────────────────────────────────── */
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await notificationService.getUserNotifications(
      req.user._id, 
      page, 
      limit
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   PATCH /api/notifications/:id/read - Mark notification as read
──────────────────────────────────────────────────────────────────── */
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id, 
      req.user._id
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   PATCH /api/notifications/read-all - Mark all notifications as read
──────────────────────────────────────────────────────────────────── */
router.patch('/read-all', protect, async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user._id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /api/notifications/unread-count - Get unread count
──────────────────────────────────────────────────────────────────── */
router.get('/unread-count', protect, async (req, res) => {
  try {
    const result = await notificationService.getUserNotifications(req.user._id, 1, 1);
    res.json({ count: result.unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;