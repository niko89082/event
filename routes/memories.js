// routes/memories.js - FIXED: Memory creation route
const express = require('express');
const router = express.Router();
const Memory = require('../models/Memory');
const MemoryPhoto = require('../models/MemoryPhoto');
const User = require('../models/User');
const auth = require('../middleware/auth'); // Your auth middleware

// ✅ FIXED: Create memory endpoint
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, participantIds = [] } = req.body;
    const creatorId = req.user.id; // From auth middleware
    
    console.log('🚀 Creating memory with data:', {
      title,
      description,
      creatorId,
      participantIds
    });
    
    // ✅ VALIDATION: Check if title is provided
    if (!title || !title.trim()) {
      return res.status(400).json({
        message: 'Memory title is required'
      });
    }
    
    // ✅ VALIDATION: Check participant count BEFORE database operations
    const totalParticipants = participantIds.length + 1; // +1 for creator
    if (totalParticipants > 15) {
      return res.status(400).json({
        message: `Cannot create memory with ${totalParticipants} participants. Maximum is 15 (including creator).`
      });
    }
    
    // ✅ VALIDATION: Verify all participant IDs exist and are valid users
    if (participantIds.length > 0) {
      console.log('🔍 Validating participantIds:', participantIds);
      
      try {
        const users = await User.find({ 
          _id: { $in: participantIds } 
        }).select('_id username');
        
        console.log('✅ Found', users.length, 'valid users out of', participantIds.length, 'requested');
        
        if (users.length !== participantIds.length) {
          const foundIds = users.map(u => u._id.toString());
          const invalidIds = participantIds.filter(id => !foundIds.includes(id));
          
          return res.status(400).json({
            message: 'Some participant IDs are invalid',
            details: { invalidIds }
          });
        }
      } catch (userError) {
        console.error('❌ Error validating participant IDs:', userError);
        return res.status(400).json({
          message: 'Invalid participant IDs format'
        });
      }
    }
    
    // ✅ CLEAN: Remove creator from participants if accidentally included
    const cleanParticipantIds = participantIds.filter(id => id !== creatorId);
    const finalParticipantCount = cleanParticipantIds.length + 1; // +1 for creator
    
    console.log('✅ Final participants:', finalParticipantCount, 'users');
    
    // ✅ CREATE: Memory with proper data
    const memoryData = {
      title: title.trim(),
      description: description ? description.trim() : '',
      creator: creatorId,
      participants: cleanParticipantIds,
      isPrivate: true // Always private by default (no toggle in frontend)
    };
    
    const memory = new Memory(memoryData);
    await memory.save();
    
    // ✅ POPULATE: Return memory with populated creator and participants
    await memory.populate([
      { 
        path: 'creator', 
        select: 'username fullName profilePicture' 
      },
      { 
        path: 'participants', 
        select: 'username fullName profilePicture' 
      }
    ]);
    
    console.log('✅ Memory created successfully:', memory._id);
    
    res.status(201).json({
      message: 'Memory created successfully',
      memory: memory
    });
    
  } catch (error) {
    console.error('❌ Error creating memory:', error);
    
    // ✅ HANDLE: Mongoose validation errors properly
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        details: errors.join(', ')
      });
    }
    
    // ✅ HANDLE: Cast errors (invalid ObjectId format)
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid ID format',
        details: error.message
      });
    }
    
    // ✅ HANDLE: Duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Memory with this title already exists'
      });
    }
    
    // ✅ HANDLE: Generic server errors
    res.status(500).json({
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// ✅ GET: User's memories
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const memories = await Memory.find({
      $or: [
        { creator: userId },
        { participants: userId }
      ]
    })
    .populate('creator', 'username fullName profilePicture')
    .populate('participants', 'username fullName profilePicture')
    .populate({
      path: 'photos',
      match: { isDeleted: false },
      populate: {
        path: 'uploadedBy',
        select: 'username'
      }
    })
    .sort({ createdAt: -1 });
    
    res.json({ memories });
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ message: 'Failed to fetch memories' });
  }
});

// ✅ GET: Single memory by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id)
      .populate('creator', 'username fullName profilePicture')
      .populate('participants', 'username fullName profilePicture')
      .populate({
        path: 'photos',
        match: { isDeleted: false },
        populate: {
          path: 'uploadedBy',
          select: 'username profilePicture'
        },
        options: { sort: { uploadedAt: -1 } }
      });
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // ✅ CHECK: User has access to this memory
    const userId = req.user.id;
    const hasAccess = memory.creator._id.equals(userId) || 
                     memory.participants.some(p => p._id.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({ memory });
  } catch (error) {
    console.error('Error fetching memory:', error);
    res.status(500).json({ message: 'Failed to fetch memory' });
  }
});

// ✅ PUT: Add participant to memory
router.put('/:id/participants', auth, async (req, res) => {
  try {
    const { participantId } = req.body;
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // Only creator can add participants
    if (!memory.creator.equals(req.user.id)) {
      return res.status(403).json({ message: 'Only creator can add participants' });
    }
    
    await memory.addParticipant(participantId);
    await memory.populate('participants', 'username fullName profilePicture');
    
    res.json({ 
      message: 'Participant added successfully',
      memory 
    });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(400).json({ message: error.message });
  }
});

// ✅ DELETE: Remove participant from memory
router.delete('/:id/participants/:participantId', auth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // Only creator can remove participants (or users can remove themselves)
    const isCreator = memory.creator.equals(req.user.id);
    const isSelf = req.params.participantId === req.user.id;
    
    if (!isCreator && !isSelf) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    await memory.removeParticipant(req.params.participantId);
    await memory.populate('participants', 'username fullName profilePicture');
    
    res.json({ 
      message: 'Participant removed successfully',
      memory 
    });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(400).json({ message: error.message });
  }
});

// ✅ POST: Upload photos to memory
const multer = require('multer');
const path = require('path');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/memory-photos/'); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'memory-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

router.post('/:id/photos', auth, upload.single('photo'), async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file provided' });
    }
    
    // ✅ Create MemoryPhoto document
    const photo = await MemoryPhoto.createPhoto({
      memoryId: memory._id,
      file: req.file,
      uploadedBy: userId,
      caption: req.body.caption
    });
    
    // ✅ Add photo reference to memory
    memory.photos.push(photo._id);
    await memory.save();
    
    // ✅ Populate the photo for response
    await photo.populate('uploadedBy', 'username profilePicture');
    
    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo: photo
    });
    
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ 
      message: 'Failed to upload photo',
      details: error.message 
    });
  }
});

// ✅ DELETE: Remove photo from memory
router.delete('/:id/photos/:photoId', auth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const photo = await MemoryPhoto.findById(req.params.photoId);
    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Verify photo belongs to this memory
    if (!photo.memory.equals(memory._id)) {
      return res.status(400).json({ message: 'Photo does not belong to this memory' });
    }
    
    // Only photo uploader or memory creator can delete
    const userId = req.user.id;
    const canDelete = photo.uploadedBy.equals(userId) || memory.creator.equals(userId);
    
    if (!canDelete) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // ✅ Soft delete the photo
    await photo.softDelete();
    
    // ✅ Remove photo reference from memory
    memory.photos = memory.photos.filter(p => !p.equals(photo._id));
    await memory.save();
    
    res.json({ message: 'Photo deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ message: 'Failed to delete photo' });
  }
});

// ✅ GET: User's memories (for profile screen)
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    
    console.log(`📚 Fetching memories for user ${userId} (requested by ${currentUserId})`);
    
    // Build query based on who's requesting
    let query;
    
    if (userId === currentUserId) {
      // Self: Show all memories where user is creator or participant
      query = {
        $or: [
          { creator: userId },
          { participants: userId }
        ]
      };
    } else {
      // Other user: Only show memories where both users are participants
      query = {
        $and: [
          {
            $or: [
              { creator: userId, participants: currentUserId },
              { creator: currentUserId, participants: userId },
              { 
                $and: [
                  { participants: userId },
                  { participants: currentUserId }
                ]
              }
            ]
          }
        ]
      };
    }
    
    const memories = await Memory.find(query)
      .populate('creator', 'username fullName profilePicture')
      .populate('participants', 'username fullName profilePicture')
      .populate({
        path: 'photos',
        match: { isDeleted: false },
        populate: {
          path: 'uploadedBy',
          select: 'username profilePicture'
        },
        options: { sort: { uploadedAt: -1 }, limit: 1 } // Just get first photo for cover
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Transform memories to include computed fields for frontend
    const transformedMemories = memories.map(memory => {
      const memoryObj = memory.toObject();
      
      return {
        ...memoryObj,
        // Add cover photo (first photo)
        coverPhoto: memoryObj.photos && memoryObj.photos.length > 0 
          ? memoryObj.photos[0].url 
          : null,
        // Add photo count
        photoCount: memoryObj.photos ? memoryObj.photos.length : 0,
        // Add participant count (including creator)
        participantCount: (memoryObj.participants ? memoryObj.participants.length : 0) + 1,
        // Add time ago
        timeAgo: getTimeAgo(memoryObj.createdAt)
      };
    });
    
    console.log(`✅ Found ${transformedMemories.length} memories for user ${userId}`);
    
    res.json({ 
      memories: transformedMemories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: memories.length === parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching user memories:', error);
    res.status(500).json({ message: 'Failed to fetch memories' });
  }
});

// ✅ HELPER: Calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2419200) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  
  return new Date(date).toLocaleDateString();
}

module.exports = router;