// routes/memories.js - Enhanced for comprehensive memories system
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

/* ═══════════════════════════════════════════════════════════════════
   ENHANCED: GET /api/memories/user/:userId - Get memories for specific user with privacy filtering
══════════════════════════════════════════════════════════════════════ */
router.get('/user/:userId?', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user._id;
    const currentUserId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    console.log(`🔍 Fetching memories for user ${targetUserId}, requested by ${currentUserId}`);

    let query;

    if (targetUserId.toString() === currentUserId.toString()) {
      // Own profile: Show ALL memories user participates in
      query = {
        $or: [
          { createdBy: currentUserId },
          { participants: currentUserId }
        ]
      };
      console.log('👤 Viewing own memories');
    } else {
      // Other user's profile: Show only shared memories between both users
      query = {
        $and: [
          { participants: currentUserId }, // Current user must be participant
          { participants: targetUserId },  // Target user must be participant
          { isPrivate: { $ne: true } }     // Exclude private memories (extra safety)
        ]
      };
      console.log('🤝 Viewing shared memories');
    }

    const memories = await Memory.find(query)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture')
      .populate({
        path: 'photos',
        options: { limit: 4, sort: { created: -1 } }, // Show latest 4 photos
        populate: { path: 'user', select: 'username profilePicture' }
      })
      .sort({ updatedAt: -1 }) // Sort by most recent activity
      .skip(skip)
      .limit(limit)
      .lean();

    // Add computed fields for each memory
    const enhancedMemories = memories.map(memory => ({
      ...memory,
      photoCount: memory.photos?.length || 0,
      participantCount: memory.participants?.length || 0,
      coverPhoto: memory.photos?.[0]?.path || null,
      lastActivity: memory.updatedAt,
      isOwner: memory.createdBy._id.toString() === currentUserId.toString(),
      timeAgo: getTimeAgo(memory.updatedAt)
    }));

    const totalMemories = await Memory.countDocuments(query);

    console.log(`✅ Found ${enhancedMemories.length} memories`);

    res.json({
      memories: enhancedMemories,
      page,
      totalPages: Math.ceil(totalMemories / limit),
      hasMore: skip + limit < totalMemories,
      total: totalMemories,
      isOwnProfile: targetUserId.toString() === currentUserId.toString()
    });

  } catch (error) {
    console.error('❌ Error fetching user memories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   NEW: GET /api/memories/shared/:userId1/:userId2 - Get shared memories between two users
══════════════════════════════════════════════════════════════════════ */
router.get('/shared/:userId1/:userId2', protect, async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const currentUserId = req.user._id;

    // Only allow if current user is one of the two users
    if (currentUserId.toString() !== userId1 && currentUserId.toString() !== userId2) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const query = {
      $and: [
        { participants: userId1 },
        { participants: userId2 },
        { isPrivate: { $ne: true } } // Extra safety
      ]
    };

    const memories = await Memory.find(query)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture')
      .populate({
        path: 'photos',
        options: { limit: 4, sort: { created: -1 } },
        populate: { path: 'user', select: 'username profilePicture' }
      })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ memories });

  } catch (error) {
    console.error('❌ Error fetching shared memories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   ENHANCED: POST /api/memories - Create new memory with better validation
══════════════════════════════════════════════════════════════════════ */
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, participantIds, isPrivate } = req.body;

    // Validation
    if (!title?.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (title.trim().length > 50) {
      return res.status(400).json({ message: 'Title must be 50 characters or less' });
    }

    if (description && description.length > 250) {
      return res.status(400).json({ message: 'Description must be 250 characters or less' });
    }

    // Validate and process participants
    const validParticipants = [];
    if (participantIds && participantIds.length > 0) {
      if (participantIds.length > 14) { // Creator + 14 others = 15 max
        return res.status(400).json({ message: 'Maximum 15 participants allowed' });
      }
      
      const users = await User.find({ _id: { $in: participantIds } }).select('_id username');
      if (users.length !== participantIds.length) {
        return res.status(400).json({ message: 'Some users not found' });
      }
      
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

    // Send notifications to participants (excluding creator)
    const notificationPromises = validParticipants
      .filter(p => p.toString() !== req.user._id.toString())
      .map(participantId => 
        Notification.create({
          user: participantId,
          sender: req.user._id,
          type: 'memory_invitation',
          title: 'New Memory',
          message: `${req.user.username} added you to a memory: "${title}"`,
          data: { memoryId: memory._id },
          actionType: 'VIEW_MEMORY',
          actionData: { memoryId: memory._id }
        })
      );

    await Promise.all(notificationPromises);

    const populatedMemory = await Memory.findById(memory._id)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture');

    console.log(`✅ Created memory "${title}" with ${validParticipants.length} participants`);

    res.status(201).json({ memory: populatedMemory });

  } catch (error) {
    console.error('❌ Error creating memory:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   ENHANCED: GET /api/memories/:memoryId - Get single memory with access control
══════════════════════════════════════════════════════════════════════ */
router.get('/:memoryId', protect, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.memoryId)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture')
      .populate({
        path: 'photos',
        populate: [
          { path: 'user', select: 'username profilePicture' },
          { path: 'comments.user', select: 'username profilePicture' },
        ],
        options: { sort: { created: -1 } }
      });

    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Check access - user must be participant or creator
    if (!memory.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add computed fields
    const enhancedMemory = {
      ...memory.toObject(),
      photoCount: memory.photos?.length || 0,
      participantCount: memory.participants?.length || 0,
      isOwner: memory.createdBy._id.toString() === req.user._id.toString(),
      canEdit: memory.createdBy._id.toString() === req.user._id.toString(),
      canAddPhotos: true, // All participants can add photos
      timeAgo: getTimeAgo(memory.updatedAt)
    };

    res.json({ memory: enhancedMemory });

  } catch (error) {
    console.error('❌ Error fetching memory:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   ENHANCED: POST /api/memories/:memoryId/photos - Add photo to memory
══════════════════════════════════════════════════════════════════════ */
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
          title: 'New Photo Added',
          message: `${req.user.username} added a photo to "${memory.title}"`,
          data: { memoryId: memory._id, photoId: photo._id },
          actionType: 'VIEW_MEMORY',
          actionData: { memoryId: memory._id }
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
          { path: 'comments.user', select: 'username profilePicture' },
        ],
      });

    res.status(201).json({ memory: populatedMemory, photo });

  } catch (error) {
    console.error('❌ Error adding photo:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   NEW: PUT /api/memories/:memoryId - Update memory (title, description)
══════════════════════════════════════════════════════════════════════ */
router.put('/:memoryId', protect, async (req, res) => {
  try {
    const { title, description } = req.body;
    
    const memory = await Memory.findById(req.params.memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Only creator can edit memory details
    if (memory.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the creator can edit this memory' });
    }

    if (title?.trim()) {
      memory.title = title.trim();
    }
    if (description !== undefined) {
      memory.description = description?.trim() || '';
    }

    memory.updatedAt = new Date();
    await memory.save();

    const populatedMemory = await Memory.findById(memory._id)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture');

    res.json({ memory: populatedMemory });

  } catch (error) {
    console.error('❌ Error updating memory:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   NEW: DELETE /api/memories/:memoryId - Delete memory (creator only)
══════════════════════════════════════════════════════════════════════ */
router.delete('/:memoryId', protect, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Only creator can delete memory
    if (memory.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the creator can delete this memory' });
    }

    // Delete all photos associated with this memory
    await MemoryPhoto.deleteMany({ memory: memory._id });

    // Delete the memory
    await Memory.findByIdAndDelete(memory._id);

    res.json({ message: 'Memory deleted successfully' });

  } catch (error) {
    console.error('❌ Error deleting memory:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   UTILITY FUNCTION: Calculate time ago
══════════════════════════════════════════════════════════════════════ */
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

module.exports = router;