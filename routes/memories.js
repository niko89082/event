// routes/memories.js - Complete with user-specific memory routes
const express = require('express');
const router = express.Router();
const Memory = require('../models/Memory');
const MemoryPhoto = require('../models/MemoryPhoto');
const User = require('../models/User');
const auth = require('../middleware/auth');
const uploadMiddleware = require('../middleware/upload');

// ✅ IMPORTANT: Specific routes MUST come before parameterized routes

// ✅ DEBUG: Test route to verify routing is working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Memory routes are working!',
    timestamp: new Date().toISOString(),
    user: req.user ? req.user.id : 'No auth'
  });
});

// ✅ GET: Get memories for a specific user (for profile pages)
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query; // Match frontend default of 50
    const skip = (page - 1) * limit;
    const currentUserId = req.user.id;

    console.log(`📋 GET /api/memories/user/${userId} - Current user: ${currentUserId}, page: ${page}, limit: ${limit}`);

    // Check if requesting user has permission to view this user's memories
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build query - user can see:
    // 1. Their own memories (public and private)
    // 2. Public memories they participate in
    // 3. Private memories they participate in
    let memoryQuery;
    
    if (currentUserId === userId) {
      // Own memories - show all
      memoryQuery = {
        $or: [
          { creator: userId },
          { participants: userId }
        ],
        isDeleted: { $ne: true }
      };
    } else {
      // Other user's memories - only show:
      // - Public memories where target user is involved
      // - Memories where current user is also a participant
      memoryQuery = {
        $or: [
          // Public memories created by target user
          { creator: userId, isPrivate: false },
          // Public memories where target user participates
          { participants: userId, isPrivate: false },
          // Any memories where both users participate
          { 
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
          }
        ],
        isDeleted: { $ne: true }
      };
    }

    const memories = await Memory.find(memoryQuery)
      .populate('creator', 'username profilePicture fullName')
      .populate('participants', 'username profilePicture fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    console.log(`📋 Found ${memories.length} memories for user ${userId}`);

    // For each memory, get preview data
    const memoriesWithPhotos = await Promise.all(
      memories.map(async (memory) => {
        // Get cover photo (most recent)
        const coverPhoto = await MemoryPhoto.findOne({
          memory: memory._id,
          isDeleted: false
        })
        .sort({ uploadedAt: -1 })
        .lean();

        // Get sample photos (first 3)
        const samplePhotos = await MemoryPhoto.find({
          memory: memory._id,
          isDeleted: false
        })
        .limit(3)
        .sort({ uploadedAt: -1 })
        .lean();

        // Get total stats
        const totalLikes = await MemoryPhoto.aggregate([
          { $match: { memory: memory._id, isDeleted: false } },
          { $group: { _id: null, total: { $sum: { $size: '$likes' } } } }
        ]);

        const totalComments = await MemoryPhoto.aggregate([
          { $match: { memory: memory._id, isDeleted: false } },
          { $group: { _id: null, total: { $sum: { $size: '$comments' } } } }
        ]);

        return {
          ...memory,
          coverPhoto: coverPhoto ? 
            `${req.protocol}://${req.get('host')}${coverPhoto.url}` : null,
          samplePhotos: samplePhotos.map(photo => ({
            ...photo,
            fullUrl: `${req.protocol}://${req.get('host')}${photo.url}`
          })),
          photoCount: samplePhotos.length,
          totalLikes: totalLikes[0]?.total || 0,
          totalComments: totalComments[0]?.total || 0,
          lastActivity: coverPhoto?.uploadedAt || memory.updatedAt
        };
      })
    );

    // Get total count
    const totalMemories = await Memory.countDocuments(memoryQuery);

    res.json({
      success: true,
      memories: memoriesWithPhotos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMemories,
        pages: Math.ceil(totalMemories / limit),
        hasMore: skip + parseInt(limit) < totalMemories
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user memories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user memories',
      details: error.message
    });
  }
});

// ✅ GET: Get shared memories between current user and target user
router.get('/shared/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    console.log(`🤝 GET /api/memories/shared/${userId} - Current user: ${currentUserId}`);

    // Find memories where both users are involved
    const sharedMemories = await Memory.find({
      $and: [
        {
          $or: [
            { creator: currentUserId },
            { participants: currentUserId }
          ]
        },
        {
          $or: [
            { creator: userId },
            { participants: userId }
          ]
        }
      ],
      isDeleted: { $ne: true }
    })
    .populate('creator', 'username profilePicture fullName')
    .populate('participants', 'username profilePicture fullName')
    .sort({ createdAt: -1 })
    .lean();

    // Get photo counts for each memory
    const memoriesWithCounts = await Promise.all(
      sharedMemories.map(async (memory) => {
        const photoCount = await MemoryPhoto.countDocuments({
          memory: memory._id,
          isDeleted: false
        });

        const coverPhoto = await MemoryPhoto.findOne({
          memory: memory._id,
          isDeleted: false
        })
        .sort({ uploadedAt: -1 })
        .lean();

        return {
          ...memory,
          photoCount,
          coverPhoto: coverPhoto ? 
            `${req.protocol}://${req.get('host')}${coverPhoto.url}` : null,
        };
      })
    );

    res.json({
      success: true,
      memories: memoriesWithCounts,
      count: memoriesWithCounts.length
    });

  } catch (error) {
    console.error('❌ Error fetching shared memories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shared memories',
      details: error.message
    });
  }
});

// ✅ GET: Get all memories for current user (ROOT ROUTE)
router.get('/', auth, async (req, res) => {
  try {
    console.log('📋 GET /api/memories - User:', req.user.id);
    
    const { page = 1, limit = 10, sort = 'recent' } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user.id;

    // Build sort criteria
    let sortCriteria = { createdAt: -1 }; // Default: most recent
    if (sort === 'popular') {
      sortCriteria = { createdAt: -1 }; // For now, keep as recent. Could add popularity metrics later
    }

    // Get memories user has access to
    const memories = await Memory.find({
      $or: [
        { creator: userId },
        { participants: userId }
      ],
      isDeleted: { $ne: true } // Exclude soft-deleted memories
    })
    .populate('creator', 'username profilePicture fullName')
    .populate('participants', 'username profilePicture fullName')
    .sort(sortCriteria)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    console.log(`📋 Found ${memories.length} memories for user ${userId}`);

    // For each memory, get preview data
    const memoriesWithPhotos = await Promise.all(
      memories.map(async (memory) => {
        // Get cover photo (most recent)
        const coverPhoto = await MemoryPhoto.findOne({
          memory: memory._id,
          isDeleted: false
        })
        .sort({ uploadedAt: -1 })
        .lean();

        // Get sample photos (first 3)
        const samplePhotos = await MemoryPhoto.find({
          memory: memory._id,
          isDeleted: false
        })
        .limit(3)
        .sort({ uploadedAt: -1 })
        .lean();

        // Get aggregate stats
        const totalLikes = await MemoryPhoto.aggregate([
          { $match: { memory: memory._id, isDeleted: false } },
          { $group: { _id: null, total: { $sum: { $size: '$likes' } } } }
        ]);

        const totalComments = await MemoryPhoto.aggregate([
          { $match: { memory: memory._id, isDeleted: false } },
          { $group: { _id: null, total: { $sum: { $size: '$comments' } } } }
        ]);

        return {
          ...memory,
          coverPhoto: coverPhoto ? 
            `${req.protocol}://${req.get('host')}${coverPhoto.url}` : null,
          samplePhotos: samplePhotos.map(photo => ({
            ...photo,
            fullUrl: `${req.protocol}://${req.get('host')}${photo.url}`
          })),
          totalLikes: totalLikes[0]?.total || 0,
          totalComments: totalComments[0]?.total || 0,
          lastActivity: coverPhoto?.uploadedAt || memory.updatedAt
        };
      })
    );

    // Get total count for pagination
    const totalMemories = await Memory.countDocuments({
      $or: [
        { creator: userId },
        { participants: userId }
      ],
      isDeleted: { $ne: true }
    });

    res.json({
      success: true,
      memories: memoriesWithPhotos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMemories,
        pages: Math.ceil(totalMemories / limit),
        hasMore: skip + parseInt(limit) < totalMemories
      }
    });

  } catch (error) {
    console.error('❌ Error fetching memories:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch memories',
      details: error.message 
    });
  }
});

// ✅ POST: Create new memory
router.post('/', auth, async (req, res) => {
  try {
    console.log('📝 POST /api/memories - Creating memory for user:', req.user.id);
    
    const {
      title,
      description = '',
      eventId = null,
      participants = [],
      isPrivate = false,
      location = ''
    } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Title is required' 
      });
    }

    // Validate participants exist
    let participantIds = [];
    if (participants.length > 0) {
      const validParticipants = await User.find({
        _id: { $in: participants }
      }).select('_id');

      if (validParticipants.length !== participants.length) {
        return res.status(400).json({ 
          success: false,
          message: 'Some participants not found' 
        });
      }
      
      participantIds = validParticipants.map(p => p._id);
    }

    const memory = new Memory({
      title: title.trim(),
      description: description.trim(),
      creator: req.user.id,
      participants: participantIds,
      eventId,
      isPrivate,
      location: location.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await memory.save();

    await memory.populate([
      { path: 'creator', select: 'username profilePicture fullName' },
      { path: 'participants', select: 'username profilePicture fullName' }
    ]);

    console.log(`✅ Memory created successfully: ${memory._id}`);

    res.status(201).json({
      success: true,
      message: 'Memory created successfully',
      memory: memory.toJSON()
    });

  } catch (error) {
    console.error('❌ Error creating memory:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error',
        details: error.message 
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Failed to create memory',
      details: error.message 
    });
  }
});

// ✅ GET: Get memory details with populated photos including likes/comments
router.get('/:id', auth, async (req, res) => {
  try {
    console.log(`📖 GET /api/memories/${req.params.id} - User:`, req.user.id);
    
    const memory = await Memory.findById(req.params.id)
      .populate('creator', 'username profilePicture fullName')
      .populate('participants', 'username profilePicture fullName')
      .lean();

    if (!memory) {
      console.log(`❌ Memory not found: ${req.params.id}`);
      return res.status(404).json({ 
        success: false,
        message: 'Memory not found' 
      });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = memory.creator._id.equals(userId) || 
                     memory.participants.some(p => p._id.equals(userId));

    if (!hasAccess) {
      console.log(`❌ Access denied to memory ${req.params.id} for user ${userId}`);
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Get photos with likes and comments populated
    const photos = await MemoryPhoto.find({
      memory: memory._id,
      isDeleted: false
    })
    .populate('uploadedBy', 'username profilePicture fullName')
    .populate('likes', 'username profilePicture fullName')
    .populate('comments.user', 'username profilePicture fullName')
    .populate('taggedUsers', 'username profilePicture fullName')
    .sort({ uploadedAt: -1 })
    .lean();

    // Add virtual fields for each photo
    const enhancedPhotos = photos.map(photo => ({
      ...photo,
      likeCount: photo.likes ? photo.likes.length : 0,
      commentCount: photo.comments ? photo.comments.length : 0,
      isLikedByUser: photo.likes ? photo.likes.some(like => like._id.equals(userId)) : false,
      fullUrl: `${req.protocol}://${req.get('host')}${photo.url}`
    }));

    // Add photos to memory object
    const memoryWithPhotos = {
      ...memory,
      photos: enhancedPhotos,
      photoCount: enhancedPhotos.length,
      totalLikes: enhancedPhotos.reduce((sum, photo) => sum + (photo.likeCount || 0), 0),
      totalComments: enhancedPhotos.reduce((sum, photo) => sum + (photo.commentCount || 0), 0)
    };

    console.log(`✅ Memory found with ${enhancedPhotos.length} photos`);

    res.json({
      success: true,
      memory: memoryWithPhotos
    });

  } catch (error) {
    console.error('❌ Error fetching memory:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch memory',
      details: error.message 
    });
  }
});

// ✅ PUT: Update memory
router.put('/:id', auth, async (req, res) => {
  try {
    console.log(`📝 PUT /api/memories/${req.params.id} - User:`, req.user.id);
    
    const memory = await Memory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({ 
        success: false,
        message: 'Memory not found' 
      });
    }

    // Only creator can update memory
    if (!memory.creator.equals(req.user.id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Only the creator can update this memory' 
      });
    }

    const {
      title,
      description,
      participants,
      isPrivate,
      location
    } = req.body;

    // Update fields if provided
    if (title !== undefined) {
      if (!title || title.trim().length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Title cannot be empty' 
        });
      }
      memory.title = title.trim();
    }

    if (description !== undefined) {
      memory.description = description.trim();
    }

    if (isPrivate !== undefined) {
      memory.isPrivate = !!isPrivate;
    }

    if (location !== undefined) {
      memory.location = location.trim();
    }

    if (participants !== undefined) {
      let participantIds = Array.isArray(participants) ? participants : [];
      
      // Validate participants exist
      if (participantIds.length > 0) {
        const validParticipants = await User.find({
          _id: { $in: participantIds }
        }).select('_id');

        if (validParticipants.length !== participantIds.length) {
          return res.status(400).json({ 
            success: false,
            message: 'Some participants not found' 
          });
        }
      }

      memory.participants = participantIds;
    }

    memory.updatedAt = new Date();
    await memory.save();

    await memory.populate([
      { path: 'creator', select: 'username profilePicture fullName' },
      { path: 'participants', select: 'username profilePicture fullName' }
    ]);

    console.log(`✅ Memory updated successfully: ${memory._id}`);

    res.json({
      success: true,
      message: 'Memory updated successfully',
      memory: memory.toJSON()
    });

  } catch (error) {
    console.error('❌ Error updating memory:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation error',
        details: error.message 
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Failed to update memory',
      details: error.message 
    });
  }
});

// ✅ DELETE: Delete memory (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    console.log(`🗑️ DELETE /api/memories/${req.params.id} - User:`, req.user.id);
    
    const memory = await Memory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({ 
        success: false,
        message: 'Memory not found' 
      });
    }

    // Only creator can delete memory
    if (!memory.creator.equals(req.user.id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Only the creator can delete this memory' 
      });
    }

    // Soft delete all photos in the memory
    await MemoryPhoto.updateMany(
      { memory: memory._id },
      { isDeleted: true }
    );

    // Delete the memory
    await Memory.findByIdAndDelete(memory._id);

    console.log(`✅ Memory deleted successfully: ${memory._id}`);

    res.json({
      success: true,
      message: 'Memory deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting memory:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete memory',
      details: error.message 
    });
  }
});

// ✅ POST: Upload photo to memory with enhanced metadata
router.post('/:id/photos', auth, uploadMiddleware.single, async (req, res) => {
  try {
    console.log(`📸 POST /api/memories/${req.params.id}/photos - User:`, req.user.id);
    
    const memory = await Memory.findById(req.params.id);
    
    if (!memory) {
      return res.status(404).json({ 
        success: false,
        message: 'Memory not found' 
      });
    }
    
    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No photo uploaded' 
      });
    }

    // Extract metadata from request body
    const {
      caption = '',
      location = '',
      taggedUsers = '[]',
      isPrivate = false
    } = req.body;

    // Parse tagged users
    let parsedTaggedUsers = [];
    try {
      parsedTaggedUsers = JSON.parse(taggedUsers);
    } catch (e) {
      console.log('Could not parse tagged users:', e.message);
    }

    // Create memory photo document
    const memoryPhoto = new MemoryPhoto({
      memory: memory._id,
      uploadedBy: userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: `/uploads/memory-photos/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype, // Add missing field
      caption,
      location,
      taggedUsers: parsedTaggedUsers,
      isPrivate,
      likes: [], // Initialize empty arrays
      comments: [],
      uploadedAt: new Date()
    });

    await memoryPhoto.save();

    // Populate the created photo
    await memoryPhoto.populate([
      { path: 'uploadedBy', select: 'username profilePicture fullName' },
      { path: 'taggedUsers', select: 'username profilePicture fullName' }
    ]);

    // Update memory's lastActivity
    memory.updatedAt = new Date();
    await memory.save();

    console.log(`✅ Photo uploaded successfully to memory ${memory._id}`);

    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      photo: {
        ...memoryPhoto.toJSON(),
        fullUrl: `${req.protocol}://${req.get('host')}${memoryPhoto.url}`,
        likeCount: 0,
        commentCount: 0,
        isLikedByUser: false
      }
    });

  } catch (error) {
    console.error('❌ Error uploading photo:', error);
    
    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        message: 'File too large. Maximum size is 10MB.',
        code: 'FILE_TOO_LARGE'
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Failed to upload photo',
      details: error.message 
    });
  }
});

// ✅ POST: Like/unlike a memory photo
router.post('/photos/:photoId/like', auth, async (req, res) => {
  try {
    console.log(`❤️ POST /api/memories/photos/${req.params.photoId}/like - User:`, req.user.id);
    
    const photo = await MemoryPhoto.findById(req.params.photoId);
    
    if (!photo) {
      return res.status(404).json({ 
        success: false,
        message: 'Photo not found' 
      });
    }

    const userId = req.user.id;
    const isLiked = photo.likes.includes(userId);

    if (isLiked) {
      // Unlike
      photo.likes = photo.likes.filter(id => !id.equals(userId));
    } else {
      // Like
      photo.likes.push(userId);
    }

    await photo.save();

    console.log(`✅ Photo ${isLiked ? 'unliked' : 'liked'} successfully`);

    res.json({
      success: true,
      isLiked: !isLiked,
      likeCount: photo.likes.length
    });

  } catch (error) {
    console.error('❌ Error toggling like:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to toggle like',
      details: error.message 
    });
  }
});

// ✅ POST: Add comment to memory photo
router.post('/photos/:photoId/comments', auth, async (req, res) => {
  try {
    console.log(`💬 POST /api/memories/photos/${req.params.photoId}/comments - User:`, req.user.id);
    
    const photo = await MemoryPhoto.findById(req.params.photoId);
    
    if (!photo) {
      return res.status(404).json({ 
        success: false,
        message: 'Photo not found' 
      });
    }

    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Comment text is required' 
      });
    }

    const comment = {
      user: req.user.id,
      text: text.trim(),
      createdAt: new Date()
    };

    photo.comments.push(comment);
    await photo.save();

    // Populate the new comment
    await photo.populate('comments.user', 'username profilePicture fullName');
    
    const newComment = photo.comments[photo.comments.length - 1];

    console.log(`✅ Comment added successfully to photo ${req.params.photoId}`);

    res.status(201).json({
      success: true,
      comment: newComment,
      commentCount: photo.comments.length
    });

  } catch (error) {
    console.error('❌ Error adding comment:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to add comment',
      details: error.message 
    });
  }
});

// ✅ DELETE: Delete comment from memory photo
router.delete('/photos/:photoId/comments/:commentId', auth, async (req, res) => {
  try {
    console.log(`🗑️ DELETE /api/memories/photos/${req.params.photoId}/comments/${req.params.commentId} - User:`, req.user.id);
    
    const photo = await MemoryPhoto.findById(req.params.photoId);
    
    if (!photo) {
      return res.status(404).json({ 
        success: false,
        message: 'Photo not found' 
      });
    }

    const comment = photo.comments.id(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json({ 
        success: false,
        message: 'Comment not found' 
      });
    }

    // Check if user owns the comment or is the photo uploader
    const userId = req.user.id;
    const canDelete = comment.user.equals(userId) || photo.uploadedBy.equals(userId);

    if (!canDelete) {
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to delete this comment' 
      });
    }

    photo.comments.pull(req.params.commentId);
    await photo.save();

    console.log(`✅ Comment deleted successfully from photo ${req.params.photoId}`);

    res.json({
      success: true,
      message: 'Comment deleted successfully',
      commentCount: photo.comments.length
    });

  } catch (error) {
    console.error('❌ Error deleting comment:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete comment',
      details: error.message 
    });
  }
});

module.exports = router;