// routes/messages.js
const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { createNotification } = require('../utils/notifications');
const protect = require('../middleware/auth');

const router = express.Router();

// Send a message
router.post('/send', protect, async (req, res) => {
  const { recipientId, content } = req.body;

  try {
    // Create a new message
    const message = new Message({
      sender: req.user._id,
      recipient: recipientId,
      content,
    });

    await message.save();

    // Find or create a conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user._id, recipientId],
        messages: [message._id],
      });
    } else {
      conversation.messages.push(message._id);
    }

    await conversation.save();

    // Create a notification for the recipient
    createNotification(recipientId, 'message', 'You have a new message');

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages in a conversation
router.get('/conversation/:recipientId', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, req.params.recipientId] },
    }).populate({
      path: 'messages',
      populate: { path: 'sender', select: 'username' },
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.status(200).json(conversation.messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;