// routes/memories.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const protect = require('../middleware/auth');
const Memory = require('../models/Memory');
const Photo = require('../models/Photo');
const Conversation = require('../models/Conversation');

// Ensure we have a directory for memory-photos
const memoryPhotoDir = path.join(__dirname, '..', 'uploads', 'memory-photos');
if (!fs.existsSync(memoryPhotoDir)) {
  fs.mkdirSync(memoryPhotoDir, { recursive: true });
}

// Configure Multer for memory photos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, memoryPhotoDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

const router = express.Router();

/**
 * POST /memories/conversation/:conversationId
 * Create a new memory within this conversation
 * body: { title, date? }
 */
router.post('/conversation/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title, date } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Ensure user is a participant in that conversation
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(401).json({ message: 'You are not in this conversation' });
    }

    const memory = new Memory({
      title,
      date: date || Date.now(),
      conversation: conversationId,
      createdBy: req.user._id,
    });
    await memory.save();

    return res.status(201).json({ memory });
  } catch (error) {
    console.error('Error creating memory:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /memories/conversation/:conversationId
 * List all memories in a conversation
 */
router.get('/conversation/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(401).json({ message: 'You are not in this conversation' });
    }

    const memories = await Memory.find({ conversation: conversationId })
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });

    res.json({ memories });
  } catch (error) {
    console.error('Error fetching memories:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /memories/:memoryId
 * Get details of a single memory (including photos)
 */
router.get('/:memoryId', protect, async (req, res) => {
  try {
    const { memoryId } = req.params;
    const memory = await Memory.findById(memoryId)
      .populate('createdBy', 'username')
      .populate({
        path: 'photos',
        populate: { path: 'user', select: 'username' },
      });
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Check if user belongs to that memory's conversation
    const conversation = await Conversation.findById(memory.conversation);
    if (!conversation) {
      return res.status(404).json({ message: 'Memory conversation not found' });
    }
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(401).json({ message: 'You are not in this conversation' });
    }

    res.json({ memory });
  } catch (error) {
    console.error('Error fetching memory:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /memories/:memoryId/photo
 * Add a photo to a memory
 * FormData: { photo: file }
 */
router.post('/:memoryId/photo', protect, upload.single('photo'), async (req, res) => {
  try {
    const { memoryId } = req.params;
    const memory = await Memory.findById(memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Check conversation membership
    const conversation = await Conversation.findById(memory.conversation);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(401).json({ message: 'You are not in this conversation' });
    }

    // We'll store photo in /uploads/memory-photos
    const relativePath = `/uploads/memory-photos/${req.file.filename}`;

    // Create a Photo doc
    const photoDoc = new Photo({
      user: req.user._id,  // the user uploading
      paths: [relativePath],
    });
    await photoDoc.save();

    // Add photo to memory
    memory.photos.push(photoDoc._id);
    await memory.save();

    // Return updated memory with photos
    const populatedMemory = await Memory.findById(memory._id)
      .populate('createdBy', 'username')
      .populate({
        path: 'photos',
        populate: { path: 'user', select: 'username' },
      });

    return res.status(201).json({ memory: populatedMemory });
  } catch (error) {
    console.error('Error adding photo to memory:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;