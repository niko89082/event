// routes/notifications.js
const express = require('express');
const Notification = require('../models/Notification');
const protect = require('../middleware/auth');

const router = express.Router();

// Create a notification
router.post('/create', protect, async (req, res) => {
  const { userId, type, message } = req.body;

  try {
    const notification = new Notification({
      user: userId,
      type,
      message,
    });

    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get notifications for a user
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

//delete notification
router.delete('/:id', protect, async (req, res) => {
  try {
      const notification = await Notification.findById(req.params.id);
      if (!notification) {
          return res.status(404).json({ message: 'Notification not found' });
      }
      if (notification.user.toString() !== req.user._id.toString()) {
          return res.status(401).json({ message: 'Unauthorized' });
      }
      await notification.remove();
      res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
      res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;