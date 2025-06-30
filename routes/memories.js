// routes/memories.js - Complete with all functionality
const express = require('express');
const router = express.Router();
const Memory = require('../models/Memory');
const MemoryPhoto = require('../models/MemoryPhoto');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/memory-photos/');
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

// ✅ POST: Create memory
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, participantIds = [] } = req.body;
    const creatorId = req.user.id;
    
    console.log('🚀 Creating memory with data:', {
      title,
      description,
      creatorId,
      participantIds
    });
    
    if (!title || !title.trim()) {
      return res.status(400).json({
        message: 'Memory title is required'
      });
    }
    
    const totalParticipants = participantIds.length + 1;
    if (totalParticipants > 15) {
      return res.status(400).json({
        message: `Cannot create memory with ${totalParticipants} participants. Maximum is 15 (including creator).`
      });
    }
    
    if (participantIds.length > 0) {
      try {
        const users = await User.find({ 
          _id: { $in: participantIds } 
        }).select('_id username');
        
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
    
    const cleanParticipantIds = participantIds.filter(id => id !== creatorId);
    
    const memoryData = {
      title: title.trim(),
      description: description ? description.trim() : '',
      creator: creatorId,
      participants: cleanParticipantIds,
      isPrivate: true
    };
    
    const memory = new Memory(memoryData);
    await memory.save();
    
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
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        details: errors.join(', ')
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid ID format',
        details: error.message
      });
    }
    
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Memory with this title already exists'
      });
    }
    
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

// ✅ GET: User's memories (for profile screen)
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    
    console.log(`📚 Fetching memories for user ${userId} (requested by ${currentUserId})`);
    
    let query;
    
    if (userId === currentUserId) {
      // Show all memories where user is creator or participant
      query = {
        $or: [
          { creator: userId },
          { participants: userId }
        ]
      };
    } else {
      // Show only memories where both users are participants
      query = {
        $and: [
          {
            $or: [
              { creator: userId },
              { participants: userId }
            ]
          },
          {
            $or: [
              { creator: currentUserId },
              { participants: currentUserId }
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
        select: 'url uploadedBy uploadedAt caption',
        populate: {
          path: 'uploadedBy',
          select: 'username profilePicture'
        },
        options: { limit: 5, sort: { uploadedAt: -1 } }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalMemories = await Memory.countDocuments(query);

    // ✅ ENHANCED: Transform memories to include proper virtual fields
    const transformedMemories = memories.map(memory => {
      const memoryObj = memory.toObject();
      
      // Ensure virtual fields are computed
      memoryObj.photoCount = memory.photoCount;
      memoryObj.participantCount = memory.participantCount;
      memoryObj.coverPhoto = memory.coverPhoto; // This will get the first photo's URL
      
      return memoryObj;
    });
    
    res.json({
      memories: transformedMemories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMemories / parseInt(limit)),
        totalMemories,
        hasMore: parseInt(page) * parseInt(limit) < totalMemories
      }
    });
    
  } catch (error) {
    console.error('Error fetching user memories:', error);
    res.status(500).json({ message: 'Failed to fetch memories' });
  }
});

// ✅ ALSO UPDATE: Single memory route for better photo population
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
    
    const userId = req.user.id;
    const hasAccess = memory.creator._id.equals(userId) || 
                     memory.participants.some(p => p._id.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // ✅ TRANSFORM: Ensure virtual fields are included
    const memoryObj = memory.toObject();
    memoryObj.photoCount = memory.photoCount;
    memoryObj.participantCount = memory.participantCount;
    memoryObj.coverPhoto = memory.coverPhoto;
    
    res.json({ memory: memoryObj });
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
router.post('/:id/photos', auth, upload.single('photo'), async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const userId = req.user.id;
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file provided' });
    }
    
    // Create MemoryPhoto document
    const photo = new MemoryPhoto({
      memory: memory._id,
      url: `/uploads/memory-photos/${req.file.filename}`,
      filename: req.file.filename,
      originalName: req.file.originalname,
      uploadedBy: userId,
      caption: req.body.caption || '',
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
    
    await photo.save();
    
    // Add photo reference to memory
    memory.photos.push(photo._id);
    await memory.save();
    
    // Populate the photo for response
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
    
    // Soft delete the photo
    await photo.softDelete();
    
    // Remove photo reference from memory
    memory.photos = memory.photos.filter(p => !p.equals(photo._id));
    await memory.save();
    
    res.json({ message: 'Photo deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ message: 'Failed to delete photo' });
  }
});

// ✅ POST: Toggle like on memory photo
router.post('/photos/:photoId/like', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;
    
    // Find the photo
    const photo = await MemoryPhoto.findById(photoId);
    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Find the memory to check access
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // Check if user has access to this memory
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Toggle like
    const result = photo.toggleLike(userId);
    await photo.save();
    
    res.json({
      message: result.liked ? 'Photo liked' : 'Photo unliked',
      liked: result.liked,
      likeCount: result.likeCount
    });
    
  } catch (error) {
    console.error('Error toggling photo like:', error);
    res.status(500).json({ message: 'Failed to toggle like' });
  }
});

// ✅ GET: Get photo likes
router.get('/photos/:photoId/likes', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;
    
    const photo = await MemoryPhoto.findById(photoId)
      .populate('likes.user', 'username fullName profilePicture');
    
    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Check memory access
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json({
      likes: photo.likes,
      likeCount: photo.likeCount,
      userLiked: photo.likes.some(like => like.user._id.equals(userId))
    });
    
  } catch (error) {
    console.error('Error fetching photo likes:', error);
    res.status(500).json({ message: 'Failed to fetch likes' });
  }
});

// ✅ POST: Add comment to memory photo
router.post('/photos/:photoId/comments', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { text, tags = [] } = req.body;
    const userId = req.user.id;
    
    // Validate comment text
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }
    
    if (text.trim().length > 500) {
      return res.status(400).json({ message: 'Comment cannot exceed 500 characters' });
    }
    
    // Find the photo
    const photo = await MemoryPhoto.findById(photoId);
    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Check memory access
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Validate tags (if provided) - ensure tagged users are memory participants
    if (tags.length > 0) {
      const allParticipants = [memory.creator, ...memory.participants];
      const invalidTags = tags.filter(tagId => 
        !allParticipants.some(p => p.equals(tagId))
      );
      
      if (invalidTags.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot tag users who are not memory participants' 
        });
      }
    }
    
    // Add comment
    const comment = photo.addComment(userId, text, tags);
    await photo.save();
    
    // Populate the new comment
    await photo.populate({
      path: 'comments.user',
      select: 'username fullName profilePicture'
    });
    
    // Find the newly added comment
    const newComment = photo.comments[photo.comments.length - 1];
    
    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment,
      commentCount: photo.commentCount
    });
    
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// ✅ GET: Get photo comments
router.get('/photos/:photoId/comments', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    
    const photo = await MemoryPhoto.findById(photoId)
      .populate({
        path: 'comments.user',
        select: 'username fullName profilePicture'
      })
      .populate({
        path: 'comments.tags',
        select: 'username fullName'
      });
    
    if (!photo || photo.isDeleted) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    
    // Check memory access
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Sort comments by newest first and paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    
    const sortedComments = photo.comments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(startIndex, endIndex);
    
    res.json({
      comments: sortedComments,
      commentCount: photo.commentCount,
      hasMore: endIndex < photo.comments.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// ✅ DELETE: Remove comment from memory photo
router.delete('/photos/comments/:commentId', auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    
    // Find photo containing this comment
    const photo = await MemoryPhoto.findOne({
      'comments._id': commentId,
      isDeleted: false
    });
    
    if (!photo) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check memory access
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Find the specific comment
    const comment = photo.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Only comment author or memory creator can delete
    const canDelete = comment.user.equals(userId) || memory.creator.equals(userId);
    
    if (!canDelete) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    // Remove comment
    photo.comments.pull(commentId);
    await photo.save();
    
    res.json({
      message: 'Comment deleted successfully',
      commentCount: photo.commentCount
    });
    
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});


module.exports = router;