// routes/memories.js - Complete with all functionality
const express = require('express');
const router = express.Router();
const Memory = require('../models/Memory');
const MemoryPhoto = require('../models/MemoryPhoto');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const protect = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const { onMemoryPhotoUpload, onMemoryPhotoComment} = require('../utils/activityHooks');
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
router.get('/:id', auth, async (req, res) => {
  try {
    const memoryId = req.params.id;
    const userId = req.user.id;

    console.log('🔍 === FETCHING MEMORY DETAILS ===');
    console.log('📋 Request details:', { memoryId, userId });

    // Validate memory ID format
    if (!memoryId || !memoryId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error('❌ Invalid memory ID format:', memoryId);
      return res.status(400).json({ 
        message: 'Invalid memory ID format',
        error: 'INVALID_MEMORY_ID'
      });
    }

    const memory = await Memory.findById(memoryId)
      .populate('creator', 'username fullName profilePicture')
      .populate('participants', 'username fullName profilePicture')
      .populate({
        path: 'photos',
        match: { isDeleted: false },
        populate: {
          path: 'uploadedBy',
          select: 'username fullName profilePicture'
        },
        options: { sort: { uploadedAt: -1 } }
      });
    
    if (!memory) {
      console.error('❌ Memory not found:', memoryId);
      return res.status(404).json({ 
        message: 'Memory not found',
        error: 'MEMORY_NOT_FOUND'
      });
    }

    // Check access permissions
    const hasAccess = memory.creator._id.equals(userId) || 
                     memory.participants.some(p => p._id.equals(userId));
    
    if (!hasAccess) {
      console.error('❌ User lacks access to memory');
      return res.status(403).json({ 
        message: 'Access denied to this memory',
        error: 'ACCESS_DENIED'
      });
    }

    // ✅ CRITICAL: Add proper like status for each photo
    const photosWithLikeStatus = memory.photos.map(photo => {
      const photoObj = photo.toObject();
      
      // Calculate user like status properly
      let userLiked = false;
      let likeCount = 0;
      
      if (photo.likes && Array.isArray(photo.likes)) {
        likeCount = photo.likes.length;
        userLiked = photo.likes.some(likeId => 
          likeId.toString() === userId.toString()
        );
      }
      
      photoObj.userLiked = userLiked;
      photoObj.likeCount = likeCount;
      photoObj.commentCount = photo.comments ? photo.comments.length : 0;
      
      console.log(`📊 Photo ${photo._id} status:`, {
        userLiked,
        likeCount,
        commentCount: photoObj.commentCount
      });
      
      return photoObj;
    });

    // Create response object
    const memoryResponse = {
      ...memory.toObject(),
      photos: photosWithLikeStatus,
      photoCount: photosWithLikeStatus.length,
      participantCount: memory.participants.length + 1 // +1 for creator
    };

    console.log('✅ Memory details fetched successfully:', {
      id: memory._id.toString(),
      title: memory.title,
      photoCount: photosWithLikeStatus.length,
      participantCount: memoryResponse.participantCount
    });

    res.json({
      success: true,
      memory: memoryResponse
    });
    
  } catch (error) {
    console.error('❌ Error fetching memory details:', error);
    res.status(500).json({ 
      message: 'Failed to fetch memory details',
      error: 'SERVER_ERROR'
    });
  }
});
// ✅ GET: Single memory by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const memoryId = req.params.id;
    const userId = req.user.id;

    console.log('🔍 === FETCHING MEMORY DETAILS ===');
    console.log('📋 Request details:', { memoryId, userId });

    // Validate memory ID format
    if (!memoryId || !memoryId.match(/^[0-9a-fA-F]{24}$/)) {
      console.error('❌ Invalid memory ID format:', memoryId);
      return res.status(400).json({ 
        message: 'Invalid memory ID format',
        error: 'INVALID_MEMORY_ID'
      });
    }

    const memory = await Memory.findById(memoryId)
      .populate('creator', 'username fullName profilePicture')
      .populate('participants', 'username fullName profilePicture')
      .populate({
        path: 'photos',
        match: { isDeleted: false },
        populate: {
          path: 'uploadedBy',
          select: 'username fullName profilePicture'
        },
        options: { sort: { uploadedAt: -1 } }
      });
    
    if (!memory) {
      console.error('❌ Memory not found:', memoryId);
      return res.status(404).json({ 
        message: 'Memory not found',
        error: 'MEMORY_NOT_FOUND'
      });
    }

    // Check access permissions
    const hasAccess = memory.creator._id.equals(userId) || 
                     memory.participants.some(p => p._id.equals(userId));
    
    if (!hasAccess) {
      console.error('❌ User lacks access to memory:', {
        userId,
        creatorId: memory.creator._id.toString(),
        participantIds: memory.participants.map(p => p._id.toString())
      });
      return res.status(403).json({ 
        message: 'Access denied to this memory',
        error: 'ACCESS_DENIED'
      });
    }

    // ✅ CRITICAL: Add like status for each photo
    const photosWithLikeStatus = memory.photos.map(photo => {
      const photoObj = photo.toObject();
      photoObj.userLiked = photo.isLikedBy(userId);
      photoObj.likeCount = photo.likeCount;
      photoObj.commentCount = photo.commentCount;
      
      console.log(`📊 Photo ${photo._id} like status:`, {
        userLiked: photoObj.userLiked,
        likeCount: photoObj.likeCount,
        commentCount: photoObj.commentCount
      });
      
      return photoObj;
    });

    // Create response object
    const memoryResponse = {
      ...memory.toObject(),
      photos: photosWithLikeStatus,
      photoCount: photosWithLikeStatus.length,
      participantCount: memory.participants.length + 1 // +1 for creator
    };

    console.log('✅ Memory details fetched successfully:', {
      id: memory._id.toString(),
      title: memory.title,
      photoCount: photosWithLikeStatus.length,
      participantCount: memoryResponse.participantCount
    });

    res.json({
      success: true,
      memory: memoryResponse
    });
    
  } catch (error) {
    console.error('❌ Error fetching memory details:', error);
    res.status(500).json({ 
      message: 'Failed to fetch memory details',
      error: 'SERVER_ERROR'
    });
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
router.put('/:id/participants', protect, async (req, res) => {
  try {
    const { participantId } = req.body;
    const memoryId = req.params.id;
    
    // Verify memory exists and user has permission
    const memory = await Memory.findById(memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // Check if user is creator or already a participant
    const isCreator = memory.creator.toString() === req.user._id.toString();
    const isParticipant = memory.participants.includes(req.user._id);
    
    if (!isCreator && !isParticipant) {
      return res.status(403).json({ message: 'Not authorized to add participants' });
    }
    
    // Check if user is already a participant
    if (memory.participants.includes(participantId)) {
      return res.status(400).json({ message: 'User is already a participant' });
    }
    
    // Add participant to memory
    memory.participants.push(participantId);
    await memory.save();
    
    // 🆕 SEND NOTIFICATION
    await notificationService.sendMemoryInvitation(
      req.user._id,
      memoryId,
      [participantId]
    );
    
    console.log(`🔔 Sent memory invitation notification to ${participantId}`);
    
    res.json({ 
      success: true, 
      message: 'Participant added successfully',
      memory 
    });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ message: 'Server error' });
  }
});




// ✅ PUT: Update memory details (creator only) - NEW ROUTE
router.put('/:memoryId', auth, async (req, res) => {
  try {
    const { memoryId } = req.params;
    const { title, description } = req.body;
    const userId = req.user.id;
    
    // 🔍 DEBUG: Log everything received from frontend
    console.log('🐛 BACKEND DEBUG - Update memory request:');
    console.log('  - memoryId:', memoryId);
    console.log('  - userId:', userId);
    console.log('  - req.body:', JSON.stringify(req.body));
    console.log('  - title received:', JSON.stringify(title));
    console.log('  - description received:', JSON.stringify(description));
    console.log('  - title type:', typeof title);
    console.log('  - description type:', typeof description);
    
    // Validate input
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Memory title is required' });
    }
    
    if (title.trim().length > 50) {
      return res.status(400).json({ message: 'Title cannot exceed 50 characters' });
    }
    
    if (description && description.length > 200) {
      return res.status(400).json({ message: 'Description cannot exceed 200 characters' });
    }
    
    // Find memory and check ownership
    const memory = await Memory.findById(memoryId);
    if (!memory) {
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    // 🔍 DEBUG: Log current memory state
    console.log('🐛 BACKEND DEBUG - Current memory in DB:');
    console.log('  - current title:', JSON.stringify(memory.title));
    console.log('  - current description:', JSON.stringify(memory.description));
    
    // Only memory creator can update
    if (!memory.creator.equals(userId)) {
      return res.status(403).json({ message: 'Only memory creator can edit this memory' });
    }
    
    // 🔍 DEBUG: Log the values we're about to assign
    const newTitle = title.trim();
    const newDescription = description ? description.trim() : '';
    
    console.log('🐛 BACKEND DEBUG - Values being assigned:');
    console.log('  - newTitle:', JSON.stringify(newTitle));
    console.log('  - newDescription:', JSON.stringify(newDescription));
    
    // Update memory
    memory.title = newTitle;
    memory.description = newDescription;
    memory.updatedAt = new Date();
    
    // 🔍 DEBUG: Log memory state before saving
    console.log('🐛 BACKEND DEBUG - Memory object before save:');
    console.log('  - memory.title:', JSON.stringify(memory.title));
    console.log('  - memory.description:', JSON.stringify(memory.description));
    
    await memory.save();
    
    // 🔍 DEBUG: Log memory state after saving
    console.log('🐛 BACKEND DEBUG - Memory object after save:');
    console.log('  - memory.title:', JSON.stringify(memory.title));
    console.log('  - memory.description:', JSON.stringify(memory.description));
    
    // Populate creator and participants for response
    await memory.populate('creator', 'username fullName profilePicture');
    await memory.populate('participants', 'username fullName profilePicture');
    
    // 🔍 DEBUG: Log final response data
    const responseData = {
      message: 'Memory updated successfully',
      memory
    };
    console.log('🐛 BACKEND DEBUG - Response being sent:');
    console.log('  - response message:', responseData.message);
    console.log('  - response memory title:', JSON.stringify(responseData.memory.title));
    console.log('  - response memory description:', JSON.stringify(responseData.memory.description));
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Error updating memory:', error);
    res.status(500).json({ message: 'Failed to update memory' });
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
    
    // ✅ FIXED: Manual participant removal instead of using the buggy method
    const participantIdToRemove = req.params.participantId;
    
    // Cannot remove creator
    if (memory.creator.equals(participantIdToRemove)) {
      return res.status(400).json({ message: 'Cannot remove creator from memory' });
    }
    
    // Remove participant from array
    memory.participants = memory.participants.filter(p => 
      p && !p.equals(participantIdToRemove)  // ✅ FIXED: Added null check
    );
    
    await memory.save();
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
    const { id: memoryId } = req.params;
    const userId = req.user.id;

    console.log('🚀 === MEMORY PHOTO UPLOAD START ===');
    console.log('📋 Request details:', {
      memoryId,
      userId,
      hasFile: !!req.file,
      fileName: req.file?.filename,
      fileSize: req.file?.size,
      caption: req.body.caption
    });

    // ✅ STEP 1: Validate file upload
    if (!req.file) {
      console.error('❌ No file uploaded');
      return res.status(400).json({
        message: 'No photo file provided',
        error: 'NO_FILE'
      });
    }

    // ✅ STEP 2: Validate memory exists
    console.log('🔍 Fetching memory details...');
    const memory = await Memory.findById(memoryId)
      .populate('creator', 'username fullName profilePicture')
      .populate('participants', 'username fullName profilePicture');

    if (!memory) {
      console.error('❌ Memory not found:', memoryId);
      return res.status(404).json({
        message: 'Memory not found',
        error: 'MEMORY_NOT_FOUND'
      });
    }

    console.log('✅ Memory found:', {
      id: memory._id.toString(),
      title: memory.title,
      creatorId: memory.creator._id.toString(),
      participantCount: memory.participants.length
    });

    // ✅ STEP 3: Check user permissions
    const isCreator = memory.creator._id.equals(userId);
    const isParticipant = memory.participants.some(p => p._id.equals(userId));

    console.log('🔐 Permission check:', {
      userId: userId.toString(),
      isCreator,
      isParticipant
    });

    if (!isCreator && !isParticipant) {
      console.error('❌ User not authorized to upload photos to this memory');
      return res.status(403).json({
        message: 'Not authorized to upload photos to this memory',
        error: 'ACCESS_DENIED'
      });
    }

    console.log('✅ User permission verified:', {
      isCreator,
      isParticipant
    });

    // ✅ STEP 4: Create MemoryPhoto record
    console.log('💾 Creating MemoryPhoto record...');
    
    const photoData = {
      memory: memoryId,
      uploadedBy: userId,
      url: `/uploads/memory-photos/${req.file.filename}`,
      filename: req.file.filename,
      caption: req.body.caption || '',
      likes: [], // Initialize empty likes array
      comments: [], // Initialize empty comments array
      uploadedAt: new Date()
    };

    console.log('📄 Photo data to save:', photoData);

    // Create the MemoryPhoto document
    const memoryPhoto = new MemoryPhoto(photoData);
    await memoryPhoto.save();

    console.log('✅ MemoryPhoto saved:', {
      id: memoryPhoto._id.toString(),
      url: memoryPhoto.url,
      uploadedBy: memoryPhoto.uploadedBy.toString()
    });

    // ✅ STEP 5: Add photo reference to memory
    console.log('🔗 Adding photo reference to memory...');
    memory.photos.push(memoryPhoto._id);
    await memory.save();

    console.log('✅ Memory updated with new photo reference');

    // ✅ STEP 6: Populate the photo with uploader info for response
    await memoryPhoto.populate('uploadedBy', 'username fullName profilePicture');

    // ✅ STEP 7: Create response object with all required fields
    const responsePhoto = {
      _id: memoryPhoto._id,
      memory: memoryPhoto.memory,
      uploadedBy: {
        _id: memoryPhoto.uploadedBy._id,
        username: memoryPhoto.uploadedBy.username,
        fullName: memoryPhoto.uploadedBy.fullName,
        profilePicture: memoryPhoto.uploadedBy.profilePicture
      },
      url: memoryPhoto.url,
      filename: memoryPhoto.filename,
      caption: memoryPhoto.caption,
      likes: memoryPhoto.likes,
      comments: memoryPhoto.comments,
      likeCount: 0, // New photo starts with 0 likes
      commentCount: 0, // New photo starts with 0 comments
      userLiked: false, // New photo is not liked by uploader initially
      uploadedAt: memoryPhoto.uploadedAt,
      isDeleted: false
    };

    console.log('📤 Response photo object:', responsePhoto);

    // ✅ STEP 8: Send notifications to other participants
    console.log('🔔 Sending notifications...');
    try {
      const allParticipants = [memory.creator._id, ...memory.participants.map(p => p._id)];
      const otherParticipants = allParticipants.filter(participantId => 
        participantId.toString() !== userId.toString()
      );

      if (otherParticipants.length > 0) {
        await notificationService.sendMemoryPhotoAdded(
          userId,
          memoryId,
          otherParticipants
        );
        
        console.log(`🔔 Sent memory photo notification to ${otherParticipants.length} participants`);
      } else {
        console.log('ℹ️ No other participants to notify');
      }
    } catch (notificationError) {
      console.error('⚠️ Failed to send notifications:', notificationError);
      // Don't fail the upload if notifications fail
    }

    // ✅ STEP 9: 🆕 CREATE ACTIVITY FEED ENTRY (NEW IN PHASE 1)
    console.log('🎯 Creating activity feed entry...');
    try {
      await onMemoryPhotoUpload(memoryPhoto._id, userId, memoryId);
      console.log(`✅ Activity hook executed for memory photo upload: ${memoryPhoto._id}`);
    } catch (activityError) {
      console.error('⚠️ Failed to create activity feed entry:', activityError);
      // Don't fail the upload if activity creation fails
    }

    // ✅ STEP 10: Send success response
    const response = {
      success: true,
      message: 'Photo uploaded successfully',
      photo: responsePhoto,
      memory: {
        id: memory._id,
        title: memory.title,
        photoCount: memory.photos.length
      }
    };

    console.log('✅ === MEMORY PHOTO UPLOAD SUCCESS ===');
    console.log('📤 Sending response:', {
      photoId: responsePhoto._id,
      photoUrl: responsePhoto.url,
      memoryPhotoCount: memory.photos.length,
      activityCreated: true // ✅ NEW: Indicates activity was created
    });

    res.status(201).json(response);

  } catch (error) {
    console.error('🚨 === MEMORY PHOTO UPLOAD ERROR ===');
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      memoryId: req.params.id,
      userId: req.user?.id?.toString(),
      hasFile: !!req.file
    });

    // Handle specific error types
    let errorMessage = 'Failed to upload photo';
    let statusCode = 500;

    if (error.name === 'ValidationError') {
      errorMessage = 'Invalid photo data provided';
      statusCode = 400;
    } else if (error.name === 'CastError') {
      errorMessage = 'Invalid memory ID format';
      statusCode = 400;
    } else if (error.code === 'LIMIT_FILE_SIZE') {
      errorMessage = 'Photo file is too large';
      statusCode = 413;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: 'UPLOAD_FAILED'
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
router.post('/photos/:photoId/like', protect, async (req, res) => {
  try {
    const photoId = req.params.photoId;
    const userId = req.user._id;

    console.log('🚀 === MEMORY PHOTO LIKE REQUEST START ===');
    console.log('📷 Request details:', {
      photoId,
      userId: userId.toString(),
      timestamp: new Date().toISOString()
    });

    // Find the memory photo
    const memoryPhoto = await MemoryPhoto.findById(photoId);
    if (!memoryPhoto) {
      console.error('❌ Memory photo not found:', photoId);
      return res.status(404).json({ message: 'Memory photo not found' });
    }

    console.log('📷 Current photo state BEFORE toggle:', {
      photoId: memoryPhoto._id.toString(),
      currentLikes: memoryPhoto.likes || [],
      likesCount: memoryPhoto.likes ? memoryPhoto.likes.length : 0,
      likesType: Array.isArray(memoryPhoto.likes) ? 'array' : typeof memoryPhoto.likes
    });

    // ✅ CRITICAL: Initialize likes array if it doesn't exist
    if (!memoryPhoto.likes || !Array.isArray(memoryPhoto.likes)) {
      console.log('🔧 Initializing empty likes array');
      memoryPhoto.likes = [];
    }

    // ✅ IMPROVED: Check if user already liked (handle ObjectId properly)
    const userLikedIndex = memoryPhoto.likes.findIndex(likeId => {
      const likeIdStr = likeId.toString();
      const userIdStr = userId.toString();
      return likeIdStr === userIdStr;
    });
    
    const wasLiked = userLikedIndex !== -1;

    console.log('📷 Like status analysis:', {
      wasLiked,
      userLikedIndex,
      userIdToCheck: userId.toString(),
      currentLikesAsStrings: memoryPhoto.likes.map(id => id.toString())
    });

    let newLikedStatus;
    let newLikesArray;

    if (wasLiked) {
      console.log('👎 UNLIKE: Removing user from likes');
      // Unlike: Remove user from likes array using filter (more reliable than splice)
      newLikesArray = memoryPhoto.likes.filter(likeId => 
        likeId.toString() !== userId.toString()
      );
      newLikedStatus = false;
    } else {
      console.log('👍 LIKE: Adding user to likes');
      // Like: Add user to likes array
      newLikesArray = [...memoryPhoto.likes, userId];
      newLikedStatus = true;
    }

    console.log('📷 New state calculated:', {
      newLikedStatus,
      newCount: newLikesArray.length,
      newLikesAsStrings: newLikesArray.map(id => id.toString()),
      previousCount: memoryPhoto.likes.length
    });

    // ✅ CRITICAL: Update and save the photo
    memoryPhoto.likes = newLikesArray;
    await memoryPhoto.save();

    console.log('💾 Photo saved successfully');

    // ✅ NEW: Create consistent response format
    const response = {
      success: true,
      liked: newLikedStatus,
      userLiked: newLikedStatus,
      likeCount: newLikesArray.length,
      likesCount: newLikesArray.length, // Alternative field name
      photoId: photoId,
      message: newLikedStatus ? 'Memory photo liked' : 'Memory photo unliked',
      timestamp: new Date().toISOString()
    };

    console.log('📤 Sending response:', response);
    console.log('✅ === MEMORY PHOTO LIKE REQUEST COMPLETE ===');

    res.status(200).json(response);

  } catch (error) {
    console.error('🚨 === MEMORY PHOTO LIKE ERROR ===');
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      photoId: req.params.photoId,
      userId: req.user?._id?.toString()
    });

    res.status(500).json({ 
      message: 'Server error during like operation',
      error: 'LIKE_ERROR',
      success: false
    });
  }
});

// ✅ GET: Get photo likes
router.get('/photos/:photoId/likes', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;
    
    console.log('🚀 === GET MEMORY PHOTO LIKES START ===');
    console.log('📷 Request details:', { photoId, userId });
    
    const photo = await MemoryPhoto.findById(photoId)
      .populate({
        path: 'likes',
        select: 'username fullName profilePicture',
        options: { 
          sort: { createdAt: -1 } // Most recent likes first
        }
      });
    
    if (!photo || photo.isDeleted) {
      console.error('❌ Photo not found or deleted:', photoId);
      return res.status(404).json({ message: 'Photo not found' });
    }

    console.log('📷 Raw photo likes data:', {
      likesCount: photo.likes ? photo.likes.length : 0,
      likesType: Array.isArray(photo.likes) ? 'array' : typeof photo.likes,
      firstLike: photo.likes && photo.likes[0] ? photo.likes[0] : null
    });
    
    // Check memory access permissions
    const memory = await Memory.findById(photo.memory);
    if (!memory) {
      console.error('❌ Memory not found for photo:', photo.memory);
      return res.status(404).json({ message: 'Memory not found' });
    }
    
    const hasAccess = memory.creator.equals(userId) || 
                     memory.participants.some(p => p.equals(userId));
    
    if (!hasAccess) {
      console.error('❌ Access denied for user:', userId);
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // ✅ CRITICAL: Handle populated likes properly
    let userLiked = false;
    let likeCount = 0;
    let likesWithUserData = [];
    
    if (photo.likes && Array.isArray(photo.likes)) {
      likeCount = photo.likes.length;
      
      // Check if likes are populated with user data or just ObjectIds
      if (photo.likes.length > 0) {
        const firstLike = photo.likes[0];
        
        if (firstLike && firstLike.username) {
          // Likes are populated with user data
          console.log('✅ Likes are populated with user data');
          likesWithUserData = photo.likes.map(user => ({
            _id: user._id,
            username: user.username,
            fullName: user.fullName,
            profilePicture: user.profilePicture
          }));
          
          userLiked = photo.likes.some(user => 
            user._id.toString() === userId.toString()
          );
        } else {
          // Likes are just ObjectIds - need to populate manually
          console.log('⚠️ Likes are not populated, manually checking user status');
          userLiked = photo.likes.some(likeId => 
            likeId.toString() === userId.toString()
          );
          
          // For response, we'll populate the users
          const populatedUsers = await User.find({
            _id: { $in: photo.likes }
          }).select('username fullName profilePicture');
          
          likesWithUserData = populatedUsers.map(user => ({
            _id: user._id,
            username: user.username,
            fullName: user.fullName,
            profilePicture: user.profilePicture
          }));
        }
      }
    }
    
    console.log('📊 Final like status:', {
      userLiked,
      likeCount,
      likesWithUserDataCount: likesWithUserData.length,
      usernames: likesWithUserData.map(u => u.username)
    });
    
    const response = {
      success: true,
      likes: likesWithUserData, // ✅ CRITICAL: Return user objects, not just IDs
      likeCount: likeCount,
      userLiked: userLiked,
      photoId: photoId
    };

    console.log('📤 Sending likes response with', likesWithUserData.length, 'populated users');
    console.log('✅ === GET MEMORY PHOTO LIKES COMPLETE ===');
    
    res.json(response);
    
  } catch (error) {
    console.error('🚨 Error fetching memory photo likes:', error);
    res.status(500).json({ 
      message: 'Failed to fetch likes',
      error: 'FETCH_LIKES_ERROR',
      success: false
    });
  }
});


// ✅ POST: Add comment to memory photo
router.post('/photos/:photoId/comments', auth, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { text, tags = [] } = req.body;
    const userId = req.user.id;
    
    console.log('💬 === MEMORY PHOTO COMMENT START ===');
    console.log('📋 Comment details:', {
      photoId,
      userId,
      commentText: text?.substring(0, 50) + '...',
      tagsCount: tags.length
    });
    
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
    
    // ✅ NEW: Create activity feed entry for memory photo comment
    console.log('🎯 Creating memory photo comment activity...');
    try {
      await onMemoryPhotoComment(photoId, userId, memory._id);
      console.log(`✅ Memory photo comment activity created for comment: ${newComment._id}`);
    } catch (activityError) {
      console.error('⚠️ Failed to create memory photo comment activity:', activityError);
      // Don't fail the comment if activity creation fails
    }
    
    console.log('✅ === MEMORY PHOTO COMMENT SUCCESS ===');
    
    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment,
      commentCount: photo.commentCount,
      activityCreated: true // ✅ NEW: Indicates activity was created
    });
    
  } catch (error) {
    console.error('🚨 === MEMORY PHOTO COMMENT ERROR ===');
    console.error('❌ Error adding memory photo comment:', error);
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