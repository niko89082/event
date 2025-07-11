// routes/messages.js
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const User = require('../models/User');

// [Add your notification import if needed]
// const { createNotification } = require('../utils/notifications');
const protect = require('../middleware/auth');

// Ensure uploads/photos folder exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer for images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('SERVER => [messages.js] => Setting destination => uploads/photos');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    console.log('SERVER => [messages.js] => Writing file =>', uniqueName);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

module.exports = function messageRoutes(io, connectedUsers) {
  const router = express.Router();

  /**
   * POST /messages/send
   * Body can contain:
   *  - { recipientId, conversationId, content, shareType, shareId }
   * If shareType/Id are present, we store them; content can be empty or optional.
   */
  router.post('/send', protect, async (req, res) => {
    const {
      recipientId,
      conversationId,
      content,      // text
      shareType,    // 'post' | 'event' | null
      shareId,      // ObjectId
    } = req.body;

    try {
      let conversation;
      let isNewConversation = false;

      // 1) Find or create the conversation
      if (conversationId) {
        conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return res.status(404).json({ message: 'Conversation not found' });
        }
      } else if (recipientId) {
        if (recipientId.toString() === req.user._id.toString()) {
          return res.status(400).json({ message: 'Cannot message yourself' });
        }
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          return res.status(400).json({ message: 'Recipient not found' });
        }

        conversation = await Conversation.findOne({
          participants: { $all: [req.user._id, recipientId] },
          isGroup: false,
        });

        if (!conversation) {
          conversation = new Conversation({
            participants: [req.user._id, recipientId],
          });
          await conversation.save();
          isNewConversation = true;
        }
      } else {
        return res
          .status(400)
          .json({ message: 'No conversationId or recipientId provided' });
      }

      // 2) Build message data
      const messageData = {
        sender: req.user._id,
        conversation: conversation._id,
        content: content || '',  // fallback empty
      };
      // Handle reply functionality
      if (req.body.replyTo) {
        const replyMessage = await Message.findById(req.body.replyTo)
          .populate('sender', 'username');
        if (replyMessage) {
          messageData.replyTo = replyMessage._id;
        }
      }
      // if shareType is present, store it
      const allowed = ['post', 'event', 'profile', 'memory'];
      if (shareType && !allowed.includes(shareType))
        return res.status(400).json({ message: 'Invalid shareType' });

      if (shareType) {
         messageData.shareType = shareType;
       }
      if (shareId) {
        // extra guard to avoid dangling refs
        const model =
          shareType === 'post'    ? 'Photo'   :
          shareType === 'event'   ? 'Event'   :
          shareType === 'profile' ? 'User'    : null;

        if (model) {
          const doc = await mongoose.model(model).findById(shareId);
          if (!doc) return res.status(404).json({ message: `${model} not found` });
        }
        messageData.shareId = shareId;
      }

      // if this is a 2-participant DM, store recipient
      if (!conversation.isGroup && conversation.participants.length === 2) {
        const otherUserId = conversation.participants.find(
          (pid) => pid.toString() !== req.user._id.toString()
        );
        if (otherUserId) {
          messageData.recipient = otherUserId;
        }
      }

      // 3) Create & save message
      const message = new Message(messageData);
      await message.save();

      // 4) Update conversation
      conversation.messages.push(message._id);
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.timestamp;
      await conversation.save();

      // If new conversation, notify the other user
      if (isNewConversation) {
        const populatedConvo = await Conversation.findById(conversation._id)
          .populate('participants', 'username')
          .populate('lastMessage');
        const otherUser = populatedConvo.participants.find(
          (p) => p._id.toString() !== req.user._id.toString()
        );
        if (otherUser) {
          const otherUserId = otherUser._id.toString();
          if (connectedUsers[otherUserId]) {
            connectedUsers[otherUserId].forEach((sockId) => {
              io.to(sockId).emit('conversationCreated', populatedConvo);
            });
          }
        }
      }

      // 5) Emit the message to the conversation room
      const populatedMsg = await Message.findById(message._id)
      .populate('sender', 'username')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: 'username'
        }
      })
      .populate({
        path: 'shareId',
        select: 'username pronouns profilePicture title time paths',
      });


      io.to(conversation._id.toString()).emit('message', {
        ...populatedMsg.toObject(),
        conversationId: conversation._id.toString(),
      });

      return res.status(201).json(populatedMsg);
    } catch (error) {
      console.error('Error sending message:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });

  // =========================================================
  // POST /messages/send/photo (image)
  // =========================================================
  router.post('/send/photo', protect, upload.single('photo'), async (req, res) => {
    try {
      const { recipientId, conversationId } = req.body;
      let conversation;
      let isNewConversation = false;

      if (conversationId) {
        conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return res.status(404).json({ message: 'Conversation not found' });
        }
      } else if (recipientId) {
        const recipient = await User.findById(recipientId);
        if (!recipient) {
          return res.status(400).json({ message: 'Recipient not found' });
        }
        conversation = await Conversation.findOne({
          participants: { $all: [req.user._id, recipientId] },
          isGroup: false,
        });
        if (!conversation) {
          conversation = new Conversation({
            participants: [req.user._id, recipientId],
          });
          await conversation.save();
          isNewConversation = true;
        }
      } else {
        return res.status(400).json({ message: 'No conversationId or recipientId provided' });
      }

      const fileName = req.file.filename;
      const messageData = {
        sender: req.user._id,
        conversation: conversation._id,
        content: `/uploads/photos/${fileName}`,
      };

      // if 1-1 DM
      if (!conversation.isGroup && conversation.participants.length === 2) {
        const otherUserId = conversation.participants.find(
          (pid) => pid.toString() !== req.user._id.toString()
        );
        if (otherUserId) {
          messageData.recipient = otherUserId;
        }
      }

      const message = new Message(messageData);
      await message.save();

      conversation.messages.push(message._id);
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.timestamp;
      await conversation.save();

      if (isNewConversation) {
        const populatedConvo = await Conversation.findById(conversation._id)
          .populate('participants', 'username')
          .populate('lastMessage');
        const otherUser = populatedConvo.participants.find(
          (p) => p._id.toString() !== req.user._id.toString()
        );
        if (otherUser) {
          const otherUserId = otherUser._id.toString();
          if (connectedUsers[otherUserId]) {
            connectedUsers[otherUserId].forEach((sockId) => {
              io.to(sockId).emit('conversationCreated', populatedConvo);
            });
          }
        }
      }

      const populatedMsg = await Message.findById(message._id)
        .populate('sender', 'username');
      io.to(conversation._id.toString()).emit('message', {
        ...populatedMsg.toObject(),
        conversationId: conversation._id.toString(),
      });

      return res.status(201).json(populatedMsg);
    } catch (error) {
      console.error('Error creating photo message:', error);
      return res.status(500).json({ message: 'Server error', error: error.message });
    }
  });


  // =======================================================================
  // Group messaging routes
  // =======================================================================
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
      conversation.messages.push(message._id);
      await conversation.save();

      // Populate sender
      const populatedMsg = await Message.findById(message._id).populate(
        'sender',
        'username'
      );

      // Emit a "message" event so all group members see it
      io.to(conversation._id.toString()).emit('message', {
        ...populatedMsg.toObject(),
        conversationId: conversation._id.toString(),
      });

      res
        .status(201)
        .json({ message: 'Group message sent', conversation, message: populatedMsg });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

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
      conversation.messages.push(message._id);
      await conversation.save();

      // Populate the new message's sender
      const populatedMsg = await Message.findById(message._id)
              .populate('sender', 'username')
              .populate({
                path: 'shareId',
                select: 'username pronouns profilePicture title time paths', 
      });

      // Emit to group room
      io.to(conversation._id.toString()).emit('message', {
        ...populatedMsg.toObject(),
        conversationId: conversation._id.toString(),
      });

      res.status(201).json({ message: 'Message sent', message: populatedMsg });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // =======================================================================
  // Mark a message as read
  // =======================================================================
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

  // =======================================================================
  // GET /messages/my-conversations
  // =======================================================================
  router.get('/my-conversations', protect, async (req, res) => {
    try {
      const conversations = await Conversation.find({
        participants: req.user._id,
      })
        .populate('participants', 'username')
        .populate('group', 'name')
        .populate('lastMessage');

      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // =======================================================================
  // GET /messages/conversation/:recipientId
  // (Might be legacy, but we keep it for reference)
  // =======================================================================
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

  // =======================================================================
  // GET /messages/conversation/byId/:conversationId
  // (Pagination example)
  // =======================================================================
  router.get('/conversation/byId/:conversationId', protect, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const skip = parseInt(req.query.skip) || 0;

      const conversation = await Conversation.findById(req.params.conversationId);
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      let messages = await Message.find({ conversation: conversation._id })
      .populate('sender', 'username profilePicture')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: 'username'
        }
      })
      .populate('seenBy', 'username')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

      // reverse => chronological
      messages = messages.reverse();

      const hasMore = messages.length === limit;

      res.status(200).json({ messages, hasMore });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // In messages.js -> router.get('/conversation/:conversationId/info')
router.get('/conversation/:conversationId/info', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'username')
      .populate('group');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check membership
    if (!conversation.participants.some((p) => p._id.equals(req.user._id))) {
      return res.status(403).json({ message: 'Not in this conversation' });
    }

    // recentPhotos
    const photoMessages = await Message.find({
      conversation: conversation._id,
      content: { $regex: '^/uploads/photos/' },
    }).sort({ timestamp: -1 }).limit(20);

    const recentPhotos = photoMessages.reverse().map((m) => m.content);

    // NEW: recentShares => last 10 messages with shareType= 'post' or 'event'
    const shareMessages = await Message.find({
      conversation: conversation._id,
      shareType: { $in: ['post', 'event'] },
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('sender', 'username');
    // You can store them directly as an array. We'll pass them in "recentShares"

    let groupInfo = null;
    if (conversation.isGroup && conversation.group) {
      groupInfo = {
        _id: conversation.group._id,
        name: conversation.group.name,
        // etc
      };
    }

    return res.json({
      conversation: {
        _id: conversation._id,
        isGroup: conversation.isGroup,
        participants: conversation.participants,
      },
      group: groupInfo,
      recentPhotos,
      recentShares: shareMessages,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});


router.delete('/conversation/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Check if user is participant
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to delete this conversation' });
    }

    // Delete all messages in the conversation
    await Message.deleteMany({ conversation: conversationId });
    
    // Delete the conversation
    await Conversation.findByIdAndDelete(conversationId);

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /messages/seen/:messageId - Mark message as seen
router.post('/seen/:messageId', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Add user to seenBy array if not already there
    if (!message.seenBy.includes(req.user._id)) {
      message.seenBy.push(req.user._id);
      await message.save();
    }

    res.json({ message: 'Message marked as seen' });
  } catch (error) {
    console.error('Mark seen error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


  // Return the configured router
  return router;
};