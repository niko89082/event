// routes/memories.js - Updated for standalone memories
const express = require('express');
const Memory = require('../models/Memory');
const MemoryPhoto = require('../models/MemoryPhoto');
const User = require('../models/User');
const Notification = require('../models/Notification');
const protect = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Multer setup for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/memory-photos/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

/* ───────────────────────────────────────────────────────────────────
   POST /api/memories - Create new memory
──────────────────────────────────────────────────────────────────── */
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, participantIds, isPrivate } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    // Validate participants
    const validParticipants = [];
    if (participantIds && participantIds.length > 0) {
      if (participantIds.length > 14) { // Creator + 14 others = 15 max
        return res.status(400).json({ message: 'Maximum 15 participants allowed' });
      }
      
      const users = await User.find({ _id: { $in: participantIds } }).select('_id');
      validParticipants.push(...users.map(u => u._id));
    }

    // Always include creator
    if (!validParticipants.some(p => p.toString() === req.user._id.toString())) {
      validParticipants.push(req.user._id);
    }

    const memory = await Memory.create({
      title: title.trim(),
      description: description?.trim() || '',
      createdBy: req.user._id,
      participants: validParticipants,
      isPrivate: isPrivate || false,
    });

    // Create notifications for participants (excluding creator)
    const notificationPromises = validParticipants
      .filter(p => p.toString() !== req.user._id.toString())
      .map(participantId => 
        Notification.create({
          user: participantId,
          sender: req.user._id,
          type: 'memory_invitation',
          message: `${req.user.username} added you to a memory: "${title}"`,
          meta: { memoryId: memory._id }
        })
      );

    await Promise.all(notificationPromises);

    const populatedMemory = await Memory.findById(memory._id)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture');

    res.status(201).json({ memory: populatedMemory });
  } catch (err) {
    console.error('Error creating memory:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /api/memories/user/:userId - Get memories for user
──────────────────────────────────────────────────────────────────── */
router.get('/user/:userId?', protect, async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { createdBy: userId },
        { participants: userId }
      ]
    };

    // If viewing other user's memories, only show non-private ones
    if (userId.toString() !== req.user._id.toString()) {
      query.isPrivate = false;
    }

    const memories = await Memory.find(query)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture')
      .populate({
        path: 'photos',
        options: { limit: 3 },
        populate: { path: 'user', select: 'username' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalMemories = await Memory.countDocuments(query);

    res.json({
      memories,
      page,
      totalPages: Math.ceil(totalMemories / limit),
      hasMore: skip + limit < totalMemories
    });
  } catch (err) {
    console.error('Error fetching memories:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /api/memories/:memoryId - Get single memory
──────────────────────────────────────────────────────────────────── */
router.get('/:memoryId', protect, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.memoryId)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture')
      .populate({
        path: 'photos',
        populate: [
          { path: 'user', select: 'username profilePicture' },
          { path: 'comments.user', select: 'username' },
        ],
      });

    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Check access
    if (!memory.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ memory });
  } catch (err) {
    console.error('Error fetching memory:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   POST /api/memories/:memoryId/photos - Add photo to memory
──────────────────────────────────────────────────────────────────── */
router.post('/:memoryId/photos', protect, upload.single('photo'), async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    if (!memory.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    const photo = await MemoryPhoto.create({
      user: req.user._id,
      memory: memory._id,
      path: `/uploads/memory-photos/${req.file.filename}`,
    });

    memory.photos.push(photo._id);
    memory.updatedAt = new Date();
    await memory.save();

    // Notify other participants
    const notificationPromises = memory.participants
      .filter(p => p.toString() !== req.user._id.toString())
      .map(participantId => 
        Notification.create({
          user: participantId,
          sender: req.user._id,
          type: 'memory_photo_added',
          message: `${req.user.username} added a photo to "${memory.title}"`,
          meta: { memoryId: memory._id, photoId: photo._id }
        })
      );

    await Promise.all(notificationPromises);

    const populatedMemory = await Memory.findById(memory._id)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture')
      .populate({
        path: 'photos',
        populate: [
          { path: 'user', select: 'username profilePicture' },
          { path: 'comments.user', select: 'username' },
        ],
      });

    res.status(201).json({ memory: populatedMemory });
  } catch (err) {
    console.error('Error adding photo:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Legacy endpoint for backward compatibility
router.post('/conversation/:conversationId', protect, async (req, res) => {
  res.status(410).json({ 
    message: 'This endpoint is deprecated. Use POST /api/memories instead.' 
  });
});

router.get('/conversation/:conversationId', protect, async (req, res) => {
  res.status(410).json({ 
    message: 'This endpoint is deprecated. Use GET /api/memories/user/:userId instead.' 
  });
});

module.exports = router;