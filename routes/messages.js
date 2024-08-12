const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const { createNotification } = require('../utils/notifications');
const protect = require('../middleware/auth');
const User = require('../models/User');
const fs = require('fs'); // Add this line
const path = require("path");

const router = express.Router();

// Ensure the uploads/messages directory exists
const uploadDir = path.join(__dirname, '..', 'uploads/messages');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

//Send message
router.post('/send', protect, async (req, res) => {
  const { recipientId, content } = req.body;
  try {
      // Check if the recipient exists
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        return res.status(400).json({ message: 'Recipient not found' });
      }
    // Find or create a conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId] },
    });
    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user._id, recipientId],
      });
      await conversation.save();
    }
    // Create a new message
    const message = new Message({
      sender: req.user._id,
      recipient: recipientId,
      conversation: conversation._id,
      content,
    });
    await message.save();

    conversation.messages.push(message._id);
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.timestamp;
    await conversation.save();

    // Create a notification for the recipient
    createNotification(recipientId, 'message', 'You have a new message');

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

//send photo
router.post('/send/photo', protect, upload.single('photo'), async (req, res) => {
  const { recipientId } = req.body;

  try {
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(400).json({ message: 'Recipient not found' });
    }

    // Find or create a conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, recipientId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user._id, recipientId],
      });
      await conversation.save();
    }

    // Create the message with the conversation field
    const message = new Message({
      sender: req.user._id,
      recipient: recipientId,
      conversation: conversation._id,  // Ensure the conversation field is populated
      content: `/uploads/messages/${req.file.filename}`,
    });

    await message.save();

    conversation.messages.push(message._id);
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.timestamp;
    await conversation.save();

    createNotification(recipientId, 'message', 'You have a new message');

    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating photo message:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send a group message
router.post('/group', protect, async (req, res) => {
  const { groupId, content } = req.body;

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    let conversation = await Conversation.findOne({ group: groupId });

    if (!conversation) {
      conversation = new Conversation({
        participants: group.members,
        isGroup: true,
        group: groupId,
      });
      await conversation.save();
    }

    const message = new Message({
      sender: req.user._id,
      conversation: conversation._id,
      content,
    });

    await message.save();

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.timestamp;
    await conversation.save();

    res.status(201).json({ message: 'Group message sent', conversation, message });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Fetch messages in a group conversation
router.get('/group/:groupId', protect, async (req, res) => {
  const { groupId } = req.params;

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const conversation = await Conversation.findOne({ group: groupId });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const messages = await Message.find({ conversation: conversation._id })
      .populate('sender', 'username')
      .sort('timestamp');

    res.status(200).json({ conversation, messages });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send a message in a group conversation
router.post('/group/:groupId/message', protect, async (req, res) => {
  const { groupId } = req.params;
  const { content } = req.body;

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    let conversation = await Conversation.findOne({ group: groupId });

    if (!conversation) {
      conversation = new Conversation({
        participants: group.members,
        isGroup: true,
        group: groupId,
      });
      await conversation.save();
    }

    const message = new Message({
      sender: req.user._id,
      conversation: conversation._id,
      content,
    });

    await message.save();

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.timestamp;
    await conversation.save();

    res.status(201).json({ message: 'Message sent', message });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark a message as read
router.post('/read/:id', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    message.read = true;
    await message.save();
    res.status(200).json({ message: 'Message marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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