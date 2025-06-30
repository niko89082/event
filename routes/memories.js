// routes/memories.js - Updated with enhanced photo support and likes/comments
const express = require('express');
const router = express.Router();
const Memory = require('../models/Memory');
const MemoryPhoto = require('../models/MemoryPhoto');
const User = require('../models/User');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// ✅ GET: Get memory details with populated photos including likes/comments
router.get('/:id', auth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id)
      .populate('creator', 'username profilePicture fullName')
      .populate('participants', 'username profilePicture fullName')
      .lean();

    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Check if user has access to this memory
    const userId = req.user.id;
    const hasAccess = memory.creator._id.equals(userId) || 
                     memory.participants.some(p => p._id.equals(userId));

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
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

    res.json({
      success: true,
      memory: memoryWithPhotos
    });

  } catch (error) {
    console.error('Error fetching memory:', error);
    res.status(500).json({ 
      message: 'Failed to fetch memory',
      details: error.message 
    });
  }
});

// ✅ GET: Get all memories for user with photo previews
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'recent' } = req.query;
    const skip = (page - 1) * limit;
    const userId = req.user.id;

    // Build sort criteria
    let sortCriteria = { createdAt: -1 }; // Default: most recent
    if (sort === 'popular') {
      // Sort by activity (photos, likes, comments)
      sortCriteria = { updatedAt: -1 };
    } else if (sort === 'alphabetical') {
      sortCriteria = { title: 1 };
    }

    // Find memories where user is creator or participant
    const memories = await Memory.find({
      $or: [
        { creator: userId },
        { participants: userId }
      ]
    })
    .populate('creator', 'username profilePicture fullName')
    .populate('participants', 'username profilePicture fullName')
    .sort(sortCriteria)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    // Get photo counts and cover photos for each memory
    const memoriesWithPhotos = await Promise.all(
      memories.map(async (memory) => {
        // Get photo count and recent photos
        const photoCount = await MemoryPhoto.countDocuments({
          memory: memory._id,
          isDeleted: false
        });

        // Get cover photo (most recent photo)
        const coverPhoto = await MemoryPhoto.findOne({
          memory: memory._id,
          isDeleted: false
        })
        .sort({ uploadedAt: -1 })
        .select('url uploadedAt')
        .lean();

        // Get sample photos for preview
        const samplePhotos = await MemoryPhoto.find({
          memory: memory._id,
          isDeleted: false
        })
        .populate('uploadedBy', 'username profilePicture')
        .sort({ uploadedAt: -1 })
        .limit(3)
        .select('url uploadedAt uploadedBy likeCount commentCount')
        .lean();

        // Calculate engagement stats
        const totalLikes = await MemoryPhoto.aggregate([
          { $match: { memory: memory._id, isDeleted: false } },
          { $project: { likeCount: { $size: { $ifNull: ['$likes', []] } } } },
          { $group: { _id: null, total: { $sum: '$likeCount' } } }
        ]);

        const totalComments = await MemoryPhoto.aggregate([
          { $match: { memory: memory._id, isDeleted: false } },
          { $project: { commentCount: { $size: { $ifNull: ['$comments', []] } } } },
          { $group: { _id: null, total: { $sum: '$commentCount' } } }
        ]);

        return {
          ...memory,
          photoCount,
          coverPhoto: coverPhoto ? `${req.protocol}://${req.get('host')}${coverPhoto.url}` : null,
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
      ]
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
    console.error('Error fetching memories:', error);
    res.status(500).json({ 
      message: 'Failed to fetch memories',
      details: error.message 
    });
  }
});

// ✅ POST: Upload photo to memory with enhanced metadata
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

    // Parse tagged users if provided
    let taggedUsers = [];
    if (req.body.taggedUsers) {
      try {
        taggedUsers = JSON.parse(req.body.taggedUsers);
      } catch (error) {
        console.warn('Invalid taggedUsers format:', error);
      }
    }
    
    // ✅ Create MemoryPhoto document with enhanced data
    const photo = await MemoryPhoto.createPhoto({
      memoryId: memory._id,
      file: req.file,
      uploadedBy: userId,
      caption: req.body.caption,
      taggedUsers
    });
    
    // ✅ Add photo reference to memory
    memory.photos.push(photo._id);
    memory.updatedAt = new Date(); // Update memory's last activity
    await memory.save();
    
    // ✅ Populate the photo for response
    await photo.populate([
      { path: 'uploadedBy', select: 'username profilePicture fullName' },
      { path: 'taggedUsers', select: 'username profilePicture fullName' }
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      photo: {
        ...photo.toJSON(),
        likeCount: 0,
        commentCount: 0,
        isLikedByUser: false,
        fullUrl: `${req.protocol}://${req.get('host')}${photo.url}`
      }
    });
    
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ 
      message: 'Failed to upload photo',
      details: error.message 
    });
  }
});

// ✅ GET: Get photos for a specific memory with pagination
router.get('/:id/photos', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = 'recent' } = req.query;
    const skip = (page - 1) * limit;

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

    // Build sort criteria
    let sortCriteria = { uploadedAt: -1 }; // Default: most recent
    if (sort === 'popular') {
      // Sort by engagement (likes + comments)
      sortCriteria = [
        { $addFields: { 
          engagement: { 
            $add: [
              { $size: { $ifNull: ['$likes', []] } },
              { $size: { $ifNull: ['$comments', []] } }
            ]
          }
        }},
        { $sort: { engagement: -1, uploadedAt: -1 } }
      ];
    } else if (sort === 'oldest') {
      sortCriteria = { uploadedAt: 1 };
    }

    let photosQuery;
    if (sort === 'popular') {
      // Use aggregation for popularity sort
      photosQuery = MemoryPhoto.aggregate([
        { 
          $match: { 
            memory: memory._id, 
            isDeleted: false 
          }
        },
        ...sortCriteria,
        { $skip: skip },
        { $limit: parseInt(limit) }
      ]);
    } else {
      // Use regular query for other sorts
      photosQuery = MemoryPhoto.find({
        memory: memory._id,
        isDeleted: false
      })
      .sort(sortCriteria)
      .skip(skip)
      .limit(parseInt(limit));
    }

    const photos = await photosQuery;

    // Populate the photos if not using aggregation
    const populatedPhotos = sort === 'popular' ? 
      await MemoryPhoto.populate(photos, [
        { path: 'uploadedBy', select: 'username profilePicture fullName' },
        { path: 'likes', select: 'username profilePicture fullName' },
        { path: 'comments.user', select: 'username profilePicture fullName' },
        { path: 'taggedUsers', select: 'username profilePicture fullName' }
      ]) :
      await photos.populate([
        { path: 'uploadedBy', select: 'username profilePicture fullName' },
        { path: 'likes', select: 'username profilePicture fullName' },
        { path: 'comments.user', select: 'username profilePicture fullName' },
        { path: 'taggedUsers', select: 'username profilePicture fullName' }
      ]);

    // Add virtual fields
    const enhancedPhotos = populatedPhotos.map(photo => ({
      ...photo.toJSON(),
      likeCount: photo.likes ? photo.likes.length : 0,
      commentCount: photo.comments ? photo.comments.length : 0,
      isLikedByUser: photo.likes ? photo.likes.some(like => like._id.equals(userId)) : false,
      fullUrl: `${req.protocol}://${req.get('host')}${photo.url}`
    }));

    // Get total count
    const totalPhotos = await MemoryPhoto.countDocuments({
      memory: memory._id,
      isDeleted: false
    });

    res.json({
      success: true,
      photos: enhancedPhotos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPhotos,
        pages: Math.ceil(totalPhotos / limit),
        hasMore: skip + parseInt(limit) < totalPhotos
      }
    });

  } catch (error) {
    console.error('Error fetching memory photos:', error);
    res.status(500).json({ 
      message: 'Failed to fetch photos',
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

    // Check if user has permission to delete (uploader or memory creator)
    const userId = req.user.id;
    const canDelete = photo.uploadedBy.equals(userId) || memory.creator.equals(userId);
    
    if (!canDelete) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    // Soft delete the photo
    await photo.softDelete();

    // Remove photo reference from memory
    memory.photos = memory.photos.filter(photoId => !photoId.equals(photo._id));
    memory.updatedAt = new Date();
    await memory.save();

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ 
      message: 'Failed to delete photo',
      details: error.message 
    });
  }
});

// ✅ GET: Get memory statistics
router.get('/:id/stats', auth, async (req, res) => {
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

    // Get comprehensive statistics
    const stats = await MemoryPhoto.aggregate([
      { 
        $match: { 
          memory: memory._id, 
          isDeleted: false 
        }
      },
      {
        $group: {
          _id: null,
          totalPhotos: { $sum: 1 },
          totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
          totalComments: { $sum: { $size: { $ifNull: ['$comments', []] } } },
          totalViews: { $sum: '$viewCount' },
          totalShares: { $sum: '$shareCount' },
          avgLikesPerPhoto: { $avg: { $size: { $ifNull: ['$likes', []] } } },
          avgCommentsPerPhoto: { $avg: { $size: { $ifNull: ['$comments', []] } } },
          earliestPhoto: { $min: '$uploadedAt' },
          latestPhoto: { $max: '$uploadedAt' }
        }
      }
    ]);

    // Get top contributors
    const topContributors = await MemoryPhoto.aggregate([
      { 
        $match: { 
          memory: memory._id, 
          isDeleted: false 
        }
      },
      {
        $group: {
          _id: '$uploadedBy',
          photoCount: { $sum: 1 },
          totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } },
          totalComments: { $sum: { $size: { $ifNull: ['$comments', []] } } }
        }
      },
      { $sort: { photoCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          user: {
            _id: '$user._id',
            username: '$user.username',
            profilePicture: '$user.profilePicture',
            fullName: '$user.fullName'
          },
          photoCount: 1,
          totalLikes: 1,
          totalComments: 1
        }
      }
    ]);

    // Get activity timeline (photos per day for last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activityTimeline = await MemoryPhoto.aggregate([
      { 
        $match: { 
          memory: memory._id, 
          isDeleted: false,
          uploadedAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$uploadedAt' },
            month: { $month: '$uploadedAt' },
            day: { $dayOfMonth: '$uploadedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        memory: {
          id: memory._id,
          title: memory.title,
          createdAt: memory.createdAt,
          participantCount: memory.participants.length + 1 // +1 for creator
        },
        photos: stats[0] || {
          totalPhotos: 0,
          totalLikes: 0,
          totalComments: 0,
          totalViews: 0,
          totalShares: 0,
          avgLikesPerPhoto: 0,
          avgCommentsPerPhoto: 0,
          earliestPhoto: null,
          latestPhoto: null
        },
        topContributors,
        activityTimeline,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error fetching memory stats:', error);
    res.status(500).json({ 
      message: 'Failed to fetch memory statistics',
      details: error.message 
    });
  }
});

// ✅ POST: Create new memory
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, participantIds = [] } = req.body;
    const creatorId = req.user.id;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: 'Memory title is required' });
    }

    // Validate participants exist
    if (participantIds.length > 0) {
      const validParticipants = await User.find({
        _id: { $in: participantIds }
      }).select('_id');

      if (validParticipants.length !== participantIds.length) {
        return res.status(400).json({ message: 'Some participants not found' });
      }
    }

    const memory = await Memory.createMemory({
      title: title.trim(),
      description: description?.trim(),
      creatorId,
      participantIds
    });

    await memory.populate([
      { path: 'creator', select: 'username profilePicture fullName' },
      { path: 'participants', select: 'username profilePicture fullName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Memory created successfully',
      memory: {
        ...memory.toJSON(),
        photoCount: 0,
        totalLikes: 0,
        totalComments: 0
      }
    });

  } catch (error) {
    console.error('Error creating memory:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        details: error.message 
      });
    }

    res.status(500).json({ 
      message: 'Failed to create memory',
      details: error.message 
    });
  }
});

// ✅ PUT: Update memory details
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, participantIds } = req.body;
    const memory = await Memory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Only creator can update memory details
    if (!memory.creator.equals(req.user.id)) {
      return res.status(403).json({ message: 'Only the creator can update this memory' });
    }

    // Update fields
    if (title !== undefined) {
      if (!title || title.trim().length === 0) {
        return res.status(400).json({ message: 'Memory title cannot be empty' });
      }
      memory.title = title.trim();
    }

    if (description !== undefined) {
      memory.description = description?.trim() || '';
    }

    if (participantIds !== undefined) {
      // Validate participants exist
      if (participantIds.length > 0) {
        const validParticipants = await User.find({
          _id: { $in: participantIds }
        }).select('_id');

        if (validParticipants.length !== participantIds.length) {
          return res.status(400).json({ message: 'Some participants not found' });
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

    res.json({
      success: true,
      message: 'Memory updated successfully',
      memory: memory.toJSON()
    });

  } catch (error) {
    console.error('Error updating memory:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        details: error.message 
      });
    }

    res.status(500).json({ 
      message: 'Failed to update memory',
      details: error.message 
    });
  }
});

// ✅ DELETE: Delete memory (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const memory = await Memory.findById(req.params.id);

    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    // Only creator can delete memory
    if (!memory.creator.equals(req.user.id)) {
      return res.status(403).json({ message: 'Only the creator can delete this memory' });
    }

    // Soft delete all photos in the memory
    await MemoryPhoto.updateMany(
      { memory: memory._id },
      { isDeleted: true }
    );

    // Delete the memory
    await Memory.findByIdAndDelete(memory._id);

    res.json({
      success: true,
      message: 'Memory deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ 
      message: 'Failed to delete memory',
      details: error.message 
    });
  }
});

module.exports = router;