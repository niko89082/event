// routes/memories.js - Updated for standalone memories
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const protect = require('../middleware/auth');

const Memory = require('../models/Memory');
const MemoryPhoto = require('../models/MemoryPhoto');
const User = require('../models/User');
const Notification = require('../models/Notification');

const router = express.Router();

/* ── ensure folder for memory‑exclusive photos ────────────────────── */
const memoryDir = path.join(__dirname, '..', 'uploads', 'memory-photos');
if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

/* ── Multer config ────────────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, memoryDir),
  filename: (_, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/* ───────────────────────────────────────────────────────────────────
   POST /api/memories - Create new memory with participants
──────────────────────────────────────────────────────────────────── */
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, participantIds, isPrivate } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (participantIds && participantIds.length > 15) {
      return res.status(400).json({ message: 'Maximum 15 participants allowed' });
    }

    // Validate participant IDs exist
    const validParticipants = [];
    if (participantIds && participantIds.length > 0) {
      const users = await User.find({ _id: { $in: participantIds } }).select('_id');
      validParticipants.push(...users.map(u => u._id));
    }

    // Always include creator as participant
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
    res.status(500).json({ 
      message: 'Server error', 
      error: err.message 
    });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /api/memories/user/:userId - Get memories for a user
──────────────────────────────────────────────────────────────────── */
router.get('/user/:userId?', protect, async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Find memories where user is creator or participant
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
        options: { limit: 3 }, // Only first 3 photos for preview
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
    console.error('Error fetching user memories:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   GET /api/memories/:memoryId - Get single memory with all photos
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

    // Check if user has access to this memory
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

    // Check if user is a participant
    if (!memory.isParticipant(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    const relPath = `/uploads/memory-photos/${req.file.filename}`;

    const photo = await MemoryPhoto.create({
      user: req.user._id,
      memory: memory._id,
      path: relPath,
    });

    memory.photos.push(photo._id);
    memory.updatedAt = new Date();
    await memory.save();

    // Notify other participants about new photo
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
    console.error('Error adding photo to memory:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   PUT /api/memories/:memoryId/participants - Add/remove participants
──────────────────────────────────────────────────────────────────── */
router.put('/:memoryId/participants', protect, async (req, res) => {
  try {
    const { participantIds } = req.body;
    const memory = await Memory.findById(req.params.memoryId);

    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Only creator can modify participants
    if (memory.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only memory creator can modify participants' });
    }

    if (participantIds.length > 15) {
      return res.status(400).json({ message: 'Maximum 15 participants allowed' });
    }

    // Validate participant IDs
    const users = await User.find({ _id: { $in: participantIds } }).select('_id');
    const validParticipants = users.map(u => u._id);

    // Always include creator
    if (!validParticipants.some(p => p.toString() === req.user._id.toString())) {
      validParticipants.push(req.user._id);
    }

    memory.participants = validParticipants;
    memory.updatedAt = new Date();
    await memory.save();

    const populatedMemory = await Memory.findById(memory._id)
      .populate('createdBy', 'username profilePicture')
      .populate('participants', 'username profilePicture');

    res.json({ memory: populatedMemory });
  } catch (err) {
    console.error('Error updating participants:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   DELETE /api/memories/:memoryId - Delete memory (creator only)
──────────────────────────────────────────────────────────────────── */
router.delete('/:memoryId', protect, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.memoryId);

    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Only creator can delete
    if (memory.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only memory creator can delete this memory' });
    }

    // Delete associated photos and files
    const photos = await MemoryPhoto.find({ memory: memory._id });
    for (const photo of photos) {
      try {
        const filePath = path.join(__dirname, '..', photo.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error('Error deleting photo file:', err);
      }
    }

    await MemoryPhoto.deleteMany({ memory: memory._id });
    await Memory.findByIdAndDelete(memory._id);

    res.json({ message: 'Memory deleted successfully' });
  } catch (err) {
    console.error('Error deleting memory:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ───────────────────────────────────────────────────────────────────
   Legacy routes for backward compatibility (can be removed later)
──────────────────────────────────────────────────────────────────── */

// Legacy conversation-based creation (for existing chat functionality)
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